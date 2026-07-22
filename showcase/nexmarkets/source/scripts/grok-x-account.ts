import "dotenv/config";
import { env } from "../src/lib/env";
import { normaliseReputationPayload, normaliseXHandle } from "../src/lib/reputation-inference";
import { parseProviderJson } from "../src/lib/nexmind";

type ProviderPayload = {
  choices?: { message?: { content?: string } }[];
  citations?: string[];
  error?: { message?: string };
};

function chatCompletionsUrl(value: string) {
  const url = new URL(value);
  const path = url.pathname.replace(/\/+$/, "");
  if (!path.endsWith("/chat/completions")) url.pathname = path + "/chat/completions";
  return url.toString();
}

function providerModel(value: string) {
  const aliases: Record<string, string> = {
    "grok-4.1": "x-ai-grok-4-20",
    "grok-4.20": "x-ai-grok-4-20",
    "grok-4.2": "grok-4.2",
    "grok-4.3": "x-ai-grok-4-3",
    "grok-4.5": "x-ai-grok-4-5",
  };
  return aliases[value] || value;
}

function reputationShape(handle: string) {
  return JSON.stringify({
    identity: { name: "", username: handle, profile_image_url: "", location: "", description: "", public_metrics: {} },
    analysis: {
      windowDays: 90,
      tweetsChecked: 0,
      activeDays: 0,
      totals: { impressions: 0, likes: 0, replies: 0, reposts: 0, quotes: 0 },
      weeklyReach: [],
      topics: [],
      standout: [],
      workSignature: "",
      capabilities: [],
      selectedWork: [],
      activity: [],
      network: [],
      desiredWork: [],
      availability: "",
      analysedAt: new Date().toISOString(),
    },
  });
}

async function analyseWithGrokXSearch(handle: string) {
  const apiUrl = env.reputationNexmindApiUrl;
  const apiKey = env.reputationNexmindApiKey;
  if (!apiUrl || !apiKey) throw new Error("REPUTATION_NEXMIND_API_KEY or NEXMIND_API_KEY is not set.");

  const response = await fetch(chatCompletionsUrl(apiUrl), {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: providerModel(env.reputationNexmindModel),
      messages: [
        { role: "system", content: "You are NexMind, the NexMarkets reputation collector. Use X live search for public X evidence, then return only valid JSON for the requested schema." },
        {
          role: "user",
          content: `Use X live search to inspect the public X account @${handle} and return one valid JSON object for a NexCard base profile. Use exactly this JSON shape: ${reputationShape(handle)}. weeklyReach, topics, standout, capabilities, selectedWork, activity, network and desiredWork must always be arrays. Use the key standout, not standoutPosts. Ground every non-empty field in public X account evidence. Do not infer private role, private availability, private messages, drafts, bookmarks or non-public relationships. If a value is not publicly available from X search, use an empty string, empty array or 0. Return only JSON.`,
        },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
      search_parameters: {
        mode: "on",
        return_citations: true,
        sources: [{ type: "x", x_handles: [handle] }],
      },
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const body = await response.text();
  const payload = body ? JSON.parse(body) as ProviderPayload : {};
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!response.ok || !content) {
    const message = payload.error?.message || body.slice(0, 500);
    if (message.includes("search_parameters")) {
      throw new Error("The configured Grok provider rejected x_search/search_parameters. Use a Grok endpoint that exposes live X search, or this call can only use the text you provide in the prompt.");
    }
    throw new Error(payload.error?.message || `Grok provider returned HTTP ${response.status}: ${body.slice(0, 500)}`);
  }
  return { result: normaliseReputationPayload(parseProviderJson(content), handle), citations: payload.citations || [] };
}

function usage() {
  console.error("Usage: npm run grok:x -- <x-handle-or-url>");
  console.error("Example: npm run grok:x -- '@elonmusk'");
}

async function run() {
  const input = process.argv[2];
  if (!input) {
    usage();
    process.exit(1);
  }

  const handle = normaliseXHandle(input);
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    console.error("Enter a valid X handle, @handle, or x.com profile URL.");
    process.exit(1);
  }

  if (!env.reputationNexmindApiKey) {
    console.error("REPUTATION_NEXMIND_API_KEY or NEXMIND_API_KEY is not set.");
    process.exit(1);
  }

  console.error(`Calling Grok X search for @${handle} with model ${env.reputationNexmindModel}...`);
  const output = await analyseWithGrokXSearch(handle);
  console.log(JSON.stringify(output, null, 2));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
