ï»¿import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";

dotenv.config();

const port = Number(process.env.NEXMIND_LIVE_BRIDGE_PORT || "8787");
const apiKey = (process.env.GEMINI_LIVE_API_KEY || process.env.NEXMIND_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
const model = (process.env.GEMINI_LIVE_MODEL || "gemini-2.0-flash-live-001").trim();
const voiceName = (process.env.GEMINI_LIVE_VOICE || "Puck").trim();
const responseModalities = (process.env.GEMINI_LIVE_RESPONSE_MODALITIES || "AUDIO").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
const endpoint = (process.env.GEMINI_LIVE_WS_URL || "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent").trim();

function sendJson(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function liveUrl() {
  const url = new URL(endpoint);
  url.searchParams.set("key", apiKey);
  return url.toString();
}

function setupPayload(context) {
  const systemText = [
    "You are NexMind inside NexMarkets Studio.",
    "This is a native Gemini Live voice session, not a generic chatbot.",
    "Behave like a production interface: convert spoken intent into a production lock.",
    "Ask only short decision-changing questions. Prefer recommendations when asked.",
    "Never claim rendering, payment, publishing, submission, or saving happened unless app context says so.",
    "When enough is known, summarize the confirmed direction and tell the user to review/build in Studio.",
    context ? `Grounded NexMarkets session context: ${context}` : "",
  ].filter(Boolean).join("\n");

  return {
    setup: {
      model: model.startsWith("models/") ? model : `models/${model}`,
      generationConfig: {
        responseModalities: responseModalities,
        speechConfig: { voiceConfig: { prebuilt_voiceConfig: { voiceName: voiceName } } },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      systemInstruction: { parts: [{ text: systemText }] },
    },
  };
}

function textFrom(value) {
  return typeof value?.text === "string" ? value.text : typeof value?.transcript === "string" ? value.transcript : null;
}

function forwardGemini(client, raw) {
  let payload;
  try { payload = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8")); }
  catch { sendJson(client, { type: "error", error: "Gemini returned a non-JSON live message." }); return; }

  if (payload.setupComplete || payload.setup_complete) sendJson(client, { type: "ready", model, voiceName, responseModalities });
  if (payload.goAway || payload.go_away) sendJson(client, { type: "goaway", payload: payload.goAway || payload.go_away });
  const serverContent = payload.serverContent || payload.server_content;
  if (!serverContent) return;

  if (serverContent.interrupted) sendJson(client, { type: "interrupted" });
  if (serverContent.inputTranscription || serverContent.input_transcription) {
    const text = textFrom(serverContent.inputTranscription || serverContent.input_transcription);
    if (text) sendJson(client, { type: "inputTranscript", text });
  }
  if (serverContent.outputTranscription || serverContent.output_transcription) {
    const text = textFrom(serverContent.outputTranscription || serverContent.output_transcription);
    if (text) sendJson(client, { type: "outputTranscript", text });
  }

  const modelTurn = serverContent.modelTurn || serverContent.model_turn;
  const parts = modelTurn?.parts;
  if (Array.isArray(parts)) {
    for (const part of parts) {
      const inline = part.inlineData || part.inline_data;
      if (typeof part.text === "string") sendJson(client, { type: "text", text: part.text });
      if (inline?.data) sendJson(client, { type: "audio", mimeType: inline.mimeType || inline.mimeType || "audio/pcm;rate=24000", data: inline.data });
    }
  }
  if (serverContent.turnComplete || serverContent.turnComplete) sendJson(client, { type: "turnComplete" });
}

const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(apiKey ? 200 : 503, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ ok: Boolean(apiKey), model, voiceName, nativeGeminiLive: true }));
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "Not found" }));
});

const wss = new WebSocketServer({ server, path: "/nexmind/gemini-live" });

wss.on("connection", (client) => {
  let gemini = null;
  let ready = false;
  const queued = [];

  if (!apiKey) {
    sendJson(client, { type: "error", error: "Gemini Live is not configured. Set GEMINI_LIVE_API_KEY, NEXMIND_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY." });
    client.close(1011, "Gemini Live key missing");
    return;
  }

  function sendGemini(payload) {
    if (!gemini || gemini.readyState === WebSocket.CLOSED || gemini.readyState === WebSocket.CLOSING) return;
    if (!ready) { queued.push(payload); return; }
    gemini.send(JSON.stringify(payload));
  }

  gemini = new WebSocket(liveUrl());
  gemini.on("open", () => {
    ready = true;
    sendJson(client, { type: "connecting", model, voiceName, responseModalities });
    for (const payload of queued.splice(0)) gemini.send(JSON.stringify(payload));
  });
  gemini.on("message", (message) => forwardGemini(client, message));
  gemini.on("error", (error) => sendJson(client, { type: "error", error: error instanceof Error ? error.message : "Gemini Live socket failed." }));
  gemini.on("close", (code, reason) => {
    sendJson(client, { type: "closed", code, reason: reason.toString() });
    if (client.readyState === WebSocket.OPEN) client.close(1011, "Gemini Live closed");
  });

  client.on("message", (raw) => {
    let message;
    try { message = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8")); }
    catch { sendJson(client, { type: "error", error: "Invalid bridge message." }); return; }

    if (message.type === "setup") {
      sendGemini(setupPayload(typeof message.context === "string" ? message.context.slice(0, 24_000) : ""));
      return;
    }
    if (message.type === "audio" && typeof message.data === "string") {
      sendGemini({ realtimeInput: { mediaChunks: [{ mimeType: message.mimeType || "audio/pcm;rate=16000", data: message.data }] } });
      return;
    }
    if (message.type === "text" && typeof message.text === "string") {
      sendGemini({ clientContent: { turns: [{ role: "user", parts: [{ text: message.text.slice(0, 8_000) }] }], turnComplete: true } });
      return;
    }
    if (message.type === "commit") sendGemini({ realtimeInput: { activityEnd: {} } });
    if (message.type === "interrupt") sendGemini({ realtimeInput: { activityStart: {} } });
  });

  client.on("close", () => {
    if (gemini?.readyState === WebSocket.OPEN || gemini?.readyState === WebSocket.CONNECTING) gemini.close(1000, "Browser live session closed");
  });
});

server.listen(port, () => {
  console.log(`[gemini-live] native bridge listening on ws://127.0.0.1:${port}/nexmind/gemini-live using ${model}`);
});
