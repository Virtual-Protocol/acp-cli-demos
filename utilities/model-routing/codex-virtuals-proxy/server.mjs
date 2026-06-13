#!/usr/bin/env node

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadDotEnv(resolve(process.cwd(), ".env"));

const HOST = process.env.VIRTUALS_PROXY_HOST || "127.0.0.1";
const PORT = Number.parseInt(process.env.VIRTUALS_PROXY_PORT || "8787", 10);
const VIRTUALS_BASE_URL =
  process.env.VIRTUALS_BASE_URL || "https://compute.virtuals.io/v1";
const VIRTUALS_API_KEY = process.env.VIRTUALS_API_KEY;
const LOCAL_API_KEY = process.env.VIRTUALS_PROXY_API_KEY;
const DEBUG = process.env.VIRTUALS_PROXY_DEBUG === "1";
const FORWARD_MAX_TOKENS = process.env.VIRTUALS_PROXY_FORWARD_MAX_TOKENS === "1";
const MODEL_ALIASES = new Map([
  ["gpt-5.5", "openai-gpt-55"],
  ["gpt-5.4-mini", "openai-gpt-54-mini"],
]);

if (!VIRTUALS_API_KEY) {
  console.error("VIRTUALS_API_KEY is required.");
  process.exit(1);
}

function loadDotEnv(path) {
  if (!existsSync(path)) return;

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

const jsonHeaders = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization,content-type,x-api-key",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

function logDebug(...args) {
  if (DEBUG) {
    console.error("[virtuals-proxy]", ...args);
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, jsonHeaders);
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error(`Invalid JSON: ${error.message}`));
      }
    });
    req.on("error", reject);
  });
}

function authorized(req) {
  if (!LOCAL_API_KEY) return true;
  const authorization = req.headers.authorization || "";
  const bearer = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  return bearer === LOCAL_API_KEY || req.headers["x-api-key"] === LOCAL_API_KEY;
}

function normalizeTextContent(content) {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content);

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      if (typeof part.text === "string") return part.text;
      if (typeof part.output_text === "string") return part.output_text;
      if (part.type === "input_text" && typeof part.text === "string") {
        return part.text;
      }
      if (part.type === "output_text" && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function responseInputToMessages(input) {
  if (typeof input === "string") {
    return [{ role: "user", content: input }];
  }

  if (!Array.isArray(input)) {
    return [];
  }

  const messages = [];

  for (const item of input) {
    if (!item || typeof item !== "object") continue;

    if (item.type === "function_call_output") {
      messages.push({
        role: "tool",
        tool_call_id: item.call_id,
        content: normalizeTextContent(item.output ?? item.content),
      });
      continue;
    }

    if (item.type === "function_call") {
      messages.push({
        role: "assistant",
        content: "",
        tool_calls: [
          {
            id: item.call_id || item.id || `call_${randomUUID()}`,
            type: "function",
            function: {
              name: item.name,
              arguments:
                typeof item.arguments === "string"
                  ? item.arguments
                  : JSON.stringify(item.arguments || {}),
            },
          },
        ],
      });
      continue;
    }

    const role = item.role || (item.type === "message" ? item.role : undefined);
    if (!role) continue;

    const message = {
      role,
      content: normalizeTextContent(item.content),
    };

    if (Array.isArray(item.tool_calls)) {
      message.tool_calls = item.tool_calls;
    }

    messages.push(message);
  }

  return messages;
}

function responsesToolsToChatTools(tools) {
  if (!Array.isArray(tools)) return undefined;

  const chatTools = tools
    .map((tool) => {
      if (!tool || typeof tool !== "object") return undefined;

      if (tool.type === "function" && tool.function) {
        return tool;
      }

      if (tool.type === "function" && tool.name) {
        return {
          type: "function",
          function: {
            name: tool.name,
            description: tool.description || "",
            parameters: tool.parameters || tool.input_schema || {
              type: "object",
              properties: {},
            },
            ...(typeof tool.strict === "boolean" ? { strict: tool.strict } : {}),
          },
        };
      }

      return undefined;
    })
    .filter(Boolean);

  return chatTools.length > 0 ? chatTools : undefined;
}

function responsesRequestToChat(request) {
  const messages = [];

  if (request.instructions) {
    messages.push({ role: "system", content: request.instructions });
  }

  messages.push(...responseInputToMessages(request.input));

  if (messages.length === 0 && Array.isArray(request.messages)) {
    messages.push(...request.messages);
  }

  const body = {
    model: upstreamModel(request.model),
    messages,
    stream: Boolean(request.stream),
  };

  const maxTokens = request.max_output_tokens ?? request.max_tokens;
  if (FORWARD_MAX_TOKENS && maxTokens != null) body.max_tokens = maxTokens;
  if (request.temperature != null) body.temperature = request.temperature;
  if (request.top_p != null) body.top_p = request.top_p;

  const tools = responsesToolsToChatTools(request.tools);
  if (tools) body.tools = tools;

  if (request.tool_choice && request.tool_choice !== "none") {
    body.tool_choice = request.tool_choice;
  }

  return body;
}

function upstreamModel(model) {
  return MODEL_ALIASES.get(model) || model;
}

function usageFromChat(chat) {
  const usage = chat.usage || {};
  const input = usage.prompt_tokens ?? usage.input_tokens ?? 0;
  const output = usage.completion_tokens ?? usage.output_tokens ?? 0;
  return {
    input_tokens: input,
    output_tokens: output,
    total_tokens: usage.total_tokens ?? input + output,
  };
}

function chatMessageToOutput(message) {
  const output = [];

  if (message.content) {
    output.push({
      id: `msg_${randomUUID().replaceAll("-", "")}`,
      type: "message",
      status: "completed",
      role: "assistant",
      content: [
        {
          type: "output_text",
          text: message.content,
          annotations: [],
        },
      ],
    });
  }

  if (Array.isArray(message.tool_calls)) {
    for (const toolCall of message.tool_calls) {
      output.push({
        id: `fc_${randomUUID().replaceAll("-", "")}`,
        type: "function_call",
        status: "completed",
        call_id: toolCall.id || `call_${randomUUID()}`,
        name: toolCall.function?.name || toolCall.name,
        arguments:
          toolCall.function?.arguments ??
          (typeof toolCall.arguments === "string"
            ? toolCall.arguments
            : JSON.stringify(toolCall.arguments || {})),
      });
    }
  }

  if (output.length === 0) {
    output.push({
      id: `msg_${randomUUID().replaceAll("-", "")}`,
      type: "message",
      status: "completed",
      role: "assistant",
      content: [{ type: "output_text", text: "", annotations: [] }],
    });
  }

  return output;
}

function chatResponseToResponses(chat, requestedModel) {
  const choice = chat.choices?.[0] || {};
  const message = choice.message || {};
  const output = chatMessageToOutput(message);
  const responseModel = MODEL_ALIASES.has(requestedModel)
    ? requestedModel
    : chat.model || requestedModel;

  return {
    id: `resp_${randomUUID().replaceAll("-", "")}`,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    status: "completed",
    background: false,
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: null,
    model: responseModel,
    output,
    output_text: output
      .flatMap((item) => item.content || [])
      .filter((part) => part.type === "output_text")
      .map((part) => part.text)
      .join(""),
    parallel_tool_calls: false,
    previous_response_id: null,
    reasoning: null,
    store: false,
    temperature: null,
    text: { format: { type: "text" } },
    tool_choice: "auto",
    tools: [],
    top_p: null,
    truncation: "disabled",
    usage: usageFromChat(chat),
    user: null,
    metadata: {},
  };
}

function parseSseChunk(buffer, onEvent) {
  let text = buffer.toString("utf8");
  let cursor;

  while ((cursor = text.indexOf("\n\n")) !== -1) {
    const rawEvent = text.slice(0, cursor);
    text = text.slice(cursor + 2);
    const dataLines = rawEvent
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trimStart());
    if (dataLines.length > 0) {
      onEvent(dataLines.join("\n"));
    }
  }

  return Buffer.from(text, "utf8");
}

function sse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function handleStreamingResponse(res, chatResponse, requestedModel) {
  const responseId = `resp_${randomUUID().replaceAll("-", "")}`;
  const messageId = `msg_${randomUUID().replaceAll("-", "")}`;
  const createdAt = Math.floor(Date.now() / 1000);
  let residual = Buffer.alloc(0);
  let outputText = "";
  let messageStarted = false;
  const toolCalls = new Map();

  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });

  const baseResponse = {
    id: responseId,
    object: "response",
    created_at: createdAt,
    status: "in_progress",
    model: requestedModel,
    output: [],
    usage: null,
  };

  sse(res, "response.created", {
    type: "response.created",
    response: baseResponse,
  });
  sse(res, "response.in_progress", {
    type: "response.in_progress",
    response: baseResponse,
  });

  function ensureMessageStarted() {
    if (messageStarted) return;
    messageStarted = true;
    sse(res, "response.output_item.added", {
      type: "response.output_item.added",
      output_index: 0,
      item: {
        id: messageId,
        type: "message",
        status: "in_progress",
        role: "assistant",
        content: [],
      },
    });
    sse(res, "response.content_part.added", {
      type: "response.content_part.added",
      item_id: messageId,
      output_index: 0,
      content_index: 0,
      part: { type: "output_text", text: "", annotations: [] },
    });
  }

  function registerToolDelta(deltaToolCall) {
    const index = deltaToolCall.index ?? 0;
    const current =
      toolCalls.get(index) || {
        id: `fc_${randomUUID().replaceAll("-", "")}`,
        call_id: deltaToolCall.id || `call_${randomUUID()}`,
        name: "",
        arguments: "",
        output_index: messageStarted ? toolCalls.size + 1 : toolCalls.size,
        added: false,
      };

    if (deltaToolCall.id) current.call_id = deltaToolCall.id;
    if (deltaToolCall.function?.name) current.name = deltaToolCall.function.name;
    if (deltaToolCall.function?.arguments) {
      current.arguments += deltaToolCall.function.arguments;
    }

    if (!current.added && current.name) {
      current.added = true;
      sse(res, "response.output_item.added", {
        type: "response.output_item.added",
        output_index: current.output_index,
        item: {
          id: current.id,
          type: "function_call",
          status: "in_progress",
          call_id: current.call_id,
          name: current.name,
          arguments: "",
        },
      });
    }

    if (deltaToolCall.function?.arguments) {
      sse(res, "response.function_call_arguments.delta", {
        type: "response.function_call_arguments.delta",
        item_id: current.id,
        output_index: current.output_index,
        delta: deltaToolCall.function.arguments,
      });
    }

    toolCalls.set(index, current);
  }

  for await (const chunk of chatResponse.body) {
    residual = Buffer.concat([residual, chunk]);
    residual = parseSseChunk(residual, (data) => {
      if (data === "[DONE]") return;
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        return;
      }

      const delta = parsed.choices?.[0]?.delta || {};
      if (delta.content) {
        ensureMessageStarted();
        outputText += delta.content;
        sse(res, "response.output_text.delta", {
          type: "response.output_text.delta",
          item_id: messageId,
          output_index: 0,
          content_index: 0,
          delta: delta.content,
        });
      }

      if (Array.isArray(delta.tool_calls)) {
        for (const toolCall of delta.tool_calls) {
          registerToolDelta(toolCall);
        }
      }
    });
  }

  if (messageStarted) {
    sse(res, "response.output_text.done", {
      type: "response.output_text.done",
      item_id: messageId,
      output_index: 0,
      content_index: 0,
      text: outputText,
    });
    sse(res, "response.content_part.done", {
      type: "response.content_part.done",
      item_id: messageId,
      output_index: 0,
      content_index: 0,
      part: { type: "output_text", text: outputText, annotations: [] },
    });
    sse(res, "response.output_item.done", {
      type: "response.output_item.done",
      output_index: 0,
      item: {
        id: messageId,
        type: "message",
        status: "completed",
        role: "assistant",
        content: [{ type: "output_text", text: outputText, annotations: [] }],
      },
    });
  }

  for (const toolCall of toolCalls.values()) {
    sse(res, "response.function_call_arguments.done", {
      type: "response.function_call_arguments.done",
      item_id: toolCall.id,
      output_index: toolCall.output_index,
      arguments: toolCall.arguments,
    });
    sse(res, "response.output_item.done", {
      type: "response.output_item.done",
      output_index: toolCall.output_index,
      item: {
        id: toolCall.id,
        type: "function_call",
        status: "completed",
        call_id: toolCall.call_id,
        name: toolCall.name,
        arguments: toolCall.arguments,
      },
    });
  }

  sse(res, "response.completed", {
    type: "response.completed",
    response: {
      ...baseResponse,
      status: "completed",
      output: [
        ...(messageStarted
          ? [
              {
                id: messageId,
                type: "message",
                status: "completed",
                role: "assistant",
                content: [
                  { type: "output_text", text: outputText, annotations: [] },
                ],
              },
            ]
          : []),
        ...Array.from(toolCalls.values()).map((toolCall) => ({
          id: toolCall.id,
          type: "function_call",
          status: "completed",
          call_id: toolCall.call_id,
          name: toolCall.name,
          arguments: toolCall.arguments,
        })),
      ],
      output_text: outputText,
      usage: null,
    },
  });
  res.write("data: [DONE]\n\n");
  res.end();
}

async function forwardResponses(req, res) {
  if (!authorized(req)) {
    sendJson(res, 401, { error: { message: "Unauthorized" } });
    return;
  }

  let responsesRequest;
  try {
    responsesRequest = await readJson(req);
  } catch (error) {
    sendJson(res, 400, { error: { message: error.message } });
    return;
  }

  const requestedModel = responsesRequest.model;
  const chatRequest = responsesRequestToChat(responsesRequest);
  logDebug("responses request", JSON.stringify(responsesRequest, null, 2));
  logDebug("chat request", JSON.stringify(chatRequest, null, 2));

  const upstream = await fetch(`${VIRTUALS_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${VIRTUALS_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(chatRequest),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    sendJson(res, upstream.status, {
      error: {
        message: `Virtuals upstream error (${upstream.status}): ${text}`,
      },
    });
    return;
  }

  if (chatRequest.stream) {
    await handleStreamingResponse(res, upstream, requestedModel);
    return;
  }

  const chatResponse = await upstream.json();
  sendJson(res, 200, chatResponseToResponses(chatResponse, requestedModel));
}

async function forwardModels(req, res) {
  if (!authorized(req)) {
    sendJson(res, 401, { error: { message: "Unauthorized" } });
    return;
  }

  const upstream = await fetch(`${VIRTUALS_BASE_URL}/models`, {
    headers: { authorization: `Bearer ${VIRTUALS_API_KEY}` },
  });
  const text = await upstream.text();
  res.writeHead(upstream.status, jsonHeaders);
  res.end(text);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || HOST}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, jsonHeaders);
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/v1/models") {
      await forwardModels(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/responses") {
      await forwardResponses(req, res);
      return;
    }

    sendJson(res, 404, { error: { message: "Not found" } });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: { message: error.message } });
  }
});

server.listen(PORT, HOST, () => {
  console.error(
    `Virtuals Responses proxy listening on http://${HOST}:${PORT}/v1`
  );
});
