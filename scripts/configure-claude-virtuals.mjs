#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const DEFAULT_PROVIDER = "virtuals";
const DEFAULT_API_BASE_URL = "https://compute.virtuals.io/v1/chat/completions";
const DEFAULT_API_KEY = "$VIRTUALS_API_KEY";
const DEFAULT_MODELS = [
  "openai-gpt-55",
  "openai-gpt-55-pro",
  "openai-gpt-54-mini",
  "claude-opus-4-7-fast",
  "claude-opus-4-8",
];
const DEFAULT_MODEL = "claude-opus-4-7-fast";
const DEFAULT_THINK_MODEL = "claude-opus-4-8";
const ROUTER_KEYS = ["default", "background", "think", "longContext"];

const options = parseArgs(process.argv.slice(2));
const configPath = expandPath(options.config || "~/.claude-code-router/config.json");
const statePath = `${configPath}.virtuals-state.json`;
const backupPath = `${configPath}.before-virtuals.bak`;

if (options.help) {
  usage();
  process.exit(0);
}

if (options.mode === "restore") {
  restoreConfig();
} else if (options.mode === "default") {
  switchToDefaultClaudeCode();
} else if (options.mode === "check") {
  checkConfig();
} else {
  configureConfig();
}

function usage() {
  console.log(`Usage: scripts/configure-claude-virtuals.mjs [virtuals|restore|default|check] [options]

Activates, checks, or restores Claude Code Router config for Virtuals Chat Completions.

Commands:
  virtuals                   Switch claude-code-router to Virtuals (default)
  restore                    Restore the pre-Virtuals provider and router routes
  default                    Remove the Virtuals provider/routes when no restore state exists
  check                      Validate the active claude-code-router Virtuals config

Options:
  --config PATH              Claude Code Router config path (default: ~/.claude-code-router/config.json)
  --provider NAME            Provider name (default: ${DEFAULT_PROVIDER})
  --api-base-url URL         Virtuals chat completions URL (default: ${DEFAULT_API_BASE_URL})
  --api-key VALUE            API key value or env reference (default: ${DEFAULT_API_KEY})
  --model MODEL              Default/background route model (default: ${DEFAULT_MODEL})
  --think-model MODEL        Think/long-context route model (default: ${DEFAULT_THINK_MODEL})
  --models LIST              Comma-separated provider model list
  --default                  Alias for the default command
  --restore                  Restore the pre-Virtuals config
  -h, --help                 Show this help
`);
}

function parseArgs(args) {
  const parsed = {
    mode: "virtuals",
    help: false,
    config: undefined,
    provider: DEFAULT_PROVIDER,
    apiBaseUrl: DEFAULT_API_BASE_URL,
    apiKey: DEFAULT_API_KEY,
    model: DEFAULT_MODEL,
    thinkModel: DEFAULT_THINK_MODEL,
    models: DEFAULT_MODELS,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "virtuals":
      case "restore":
      case "default":
      case "check":
        parsed.mode = arg;
        break;
      case "--config":
        parsed.config = requiredValue(args, (index += 1), arg);
        break;
      case "--provider":
        parsed.provider = requiredValue(args, (index += 1), arg);
        break;
      case "--api-base-url":
        parsed.apiBaseUrl = requiredValue(args, (index += 1), arg);
        break;
      case "--api-key":
        parsed.apiKey = requiredValue(args, (index += 1), arg);
        break;
      case "--model":
        parsed.model = requiredValue(args, (index += 1), arg);
        break;
      case "--think-model":
        parsed.thinkModel = requiredValue(args, (index += 1), arg);
        break;
      case "--models":
        parsed.models = requiredValue(args, (index += 1), arg)
          .split(",")
          .map((model) => model.trim())
          .filter(Boolean);
        if (parsed.models.length === 0) fail("--models must include at least one model");
        break;
      case "--default":
        parsed.mode = "default";
        break;
      case "--restore":
        parsed.mode = "restore";
        break;
      case "-h":
      case "--help":
        parsed.help = true;
        break;
      default:
        fail(`Unknown argument: ${arg}`);
    }
  }

  assertProviderName(parsed.provider);
  return parsed;
}

function requiredValue(args, index, flag) {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    fail(`Missing value for ${flag}`);
  }
  return value;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function expandPath(path) {
  if (path === "~") return process.env.HOME;
  if (path.startsWith("~/")) return join(process.env.HOME, path.slice(2));
  return resolve(path);
}

function assertProviderName(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    fail("--provider must contain only letters, numbers, underscores, or dashes");
  }
}

function readConfigText() {
  return existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
}

function readConfig() {
  const text = readConfigText();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`Could not parse ${configPath}: ${error.message}`);
  }
}

function writeConfig(config) {
  writeConfigText(`${JSON.stringify(config, null, 2)}\n`);
}

function writeConfigText(text) {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, text, { mode: 0o600 });
}

function configureConfig() {
  const originalText = readConfigText();
  const originalConfig = readConfig();
  const next = clone(originalConfig);

  next.Providers = upsertProvider(next.Providers, providerConfig());
  next.Router = {
    ...(next.Router && typeof next.Router === "object" ? next.Router : {}),
    default: route(options.model),
    background: route(options.model),
    think: route(options.thinkModel),
    longContext: route(options.thinkModel),
  };

  // Detect the no-op before capturing the restore snapshot. Capturing first
  // would overwrite the existing snapshot with the current (already-Virtuals)
  // config, destroying the path back to the user's pre-Virtuals config even
  // though this run changes nothing. The existing restore point is kept.
  if (JSON.stringify(next) === JSON.stringify(originalConfig)) {
    console.log(
      `Claude Code Router config already routes through ${options.provider} — no changes made. Existing restore point kept.`,
    );
    return;
  }

  captureRestoreState(originalText, originalConfig);
  writeBackupIfMissing(originalText);
  writeConfig(next);
  console.log(`Updated ${configPath}`);
  console.log(`Active default route: ${route(options.model)}`);
  console.log(`Active think route: ${route(options.thinkModel)}`);
  console.log(`Restore with: scripts/configure-claude-virtuals.mjs restore`);
  console.log(`Restart claude-code-router with: ccr restart`);
}

function restoreConfig() {
  // Precedence: the per-activation state snapshot is the most precise restore
  // point, so prefer it. When it is missing (e.g. consumed by a prior restore,
  // or destroyed by an older buggy build), fall back to the pristine
  // `.before-virtuals.bak` baseline so there is still a path home. Only error
  // toward `default` when neither exists.
  if (!existsSync(statePath)) {
    if (existsSync(backupPath)) {
      restoreFromBackup();
      return;
    }
    fail(
      `No Virtuals state file found at ${statePath} and no baseline at ${backupPath}. Use "scripts/configure-claude-virtuals.mjs default" to remove Virtuals routes.`,
    );
  }

  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const currentText = readConfigText();
  const current = readConfig();
  const next = clone(current);

  restoreProvider(next, state);
  restoreRouter(next, state);
  cleanupEmptyContainers(next, state);

  if (!state.hadConfig && isEmptyConfig(next)) {
    if (existsSync(configPath)) unlinkSync(configPath);
  } else if (JSON.stringify(next) !== JSON.stringify(current)) {
    writeBackupIfMissing(currentText);
    writeConfig(next);
  }

  rmSync(statePath, { force: true });
  console.log(`Restored Claude Code Router config from ${statePath}`);
  console.log(`Restart claude-code-router with: ccr restart`);
}

function restoreFromBackup() {
  // The baseline is the verbatim pre-Virtuals config text. Write it straight
  // back rather than reconstructing from a parsed snapshot. Keep the baseline
  // file: it is the only frozen copy of the original config, and a later
  // restore/recovery may still need it.
  const baselineText = readFileSync(backupPath, "utf8");
  writeConfigText(ensureTrailingNewline(baselineText));
  console.log(`No restore snapshot found; restored Claude Code Router config from baseline ${backupPath}`);
  console.log(`Kept baseline ${backupPath} for future recovery.`);
  console.log(`Restart claude-code-router with: ccr restart`);
}

function switchToDefaultClaudeCode() {
  const originalText = readConfigText();
  const original = readConfig();
  const next = clone(original);

  removeProvider(next, options.provider);
  removeVirtualsRoutes(next, options.provider);
  cleanupEmptyContainers(next, { hadProviders: Boolean(original.Providers), hadRouter: Boolean(original.Router) });

  if (existsSync(configPath) && JSON.stringify(next) !== JSON.stringify(original)) {
    writeBackupIfMissing(originalText);
    writeConfig(next);
  }

  rmSync(statePath, { force: true });
  console.log(`Removed ${options.provider} routes from Claude Code Router config.`);
  console.log("Use plain `claude` for built-in Claude Code routing, or restart ccr before using another ccr config.");
}

function checkConfig() {
  const config = readConfig();
  const provider = findProvider(config.Providers, options.provider);
  const errors = [];
  const warnings = [];

  if (!provider) {
    errors.push(`Missing provider "${options.provider}"`);
  } else {
    if (provider.api_base_url !== options.apiBaseUrl) {
      warnings.push(`Provider api_base_url is ${provider.api_base_url || "<missing>"}`);
    }
    if (!provider.api_key) {
      errors.push(`Provider "${options.provider}" is missing api_key`);
    } else {
      const envReference = parseEnvReference(provider.api_key);
      if (envReference && !process.env[envReference]) {
        errors.push(`${envReference} is not set in the current shell`);
      }
    }
    const transformers = provider.transformer?.use || [];
    if (!transformers.includes("cleancache")) {
      errors.push('Provider transformer must include "cleancache" for Claude Code prompt-cache metadata');
    }
    if (!transformers.includes("anthropic")) {
      warnings.push('Provider transformer should include "anthropic" for Claude Code Router compatibility');
    }
  }

  for (const key of ROUTER_KEYS) {
    const value = config.Router?.[key];
    if (typeof value !== "string" || !value.startsWith(`${options.provider},`)) {
      warnings.push(`Router.${key} is not routed through ${options.provider}`);
    }
  }

  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    for (const warning of warnings) console.error(`WARN: ${warning}`);
    process.exit(1);
  }

  for (const warning of warnings) console.warn(`WARN: ${warning}`);
  console.log(`Claude Code Router Virtuals config looks usable at ${configPath}`);
}

function providerConfig() {
  return {
    name: options.provider,
    api_base_url: options.apiBaseUrl,
    api_key: options.apiKey,
    models: unique([...options.models, options.model, options.thinkModel]),
    transformer: {
      use: ["anthropic", "cleancache"],
    },
  };
}

function route(model) {
  return `${options.provider},${model}`;
}

function captureRestoreState(originalText, originalConfig) {
  // Snapshot the config exactly as it is on disk right now, overwriting any
  // previous snapshot, so `restore` returns to the state immediately before the
  // most recent activation. The caller gates this on a real change (see the
  // no-op check in configureConfig), so a repeat run never clobbers a good
  // snapshot. The pre-Virtuals baseline is preserved separately in
  // `.before-virtuals.bak`.
  const provider = findProvider(originalConfig.Providers, options.provider);
  const router = originalConfig.Router && typeof originalConfig.Router === "object" ? originalConfig.Router : {};
  const state = {
    createdAt: new Date().toISOString(),
    provider: options.provider,
    hadConfig: Boolean(originalText.trim()),
    hadProviders: Array.isArray(originalConfig.Providers),
    providerConfig: provider ? clone(provider) : null,
    hadRouter: Boolean(originalConfig.Router && typeof originalConfig.Router === "object"),
    routes: Object.fromEntries(
      ROUTER_KEYS.map((key) => [
        key,
        {
          had: Object.prototype.hasOwnProperty.call(router, key),
          value: router[key],
        },
      ]),
    ),
  };

  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function writeBackupIfMissing(text) {
  if (!text || existsSync(backupPath)) return;
  writeFileSync(backupPath, ensureTrailingNewline(text), { mode: 0o600 });
}

function upsertProvider(providers, provider) {
  const next = Array.isArray(providers) ? providers.filter((item) => item?.name !== provider.name) : [];
  next.push(provider);
  return next;
}

function restoreProvider(config, state) {
  if (state.providerConfig) {
    config.Providers = upsertProvider(config.Providers, state.providerConfig);
  } else {
    removeProvider(config, state.provider || options.provider);
  }
}

function removeProvider(config, providerName) {
  if (!Array.isArray(config.Providers)) return;
  config.Providers = config.Providers.filter((provider) => provider?.name !== providerName);
}

function restoreRouter(config, state) {
  if (!config.Router || typeof config.Router !== "object") config.Router = {};

  for (const key of ROUTER_KEYS) {
    const routeState = state.routes?.[key];
    if (routeState?.had) {
      config.Router[key] = routeState.value;
    } else {
      delete config.Router[key];
    }
  }
}

function removeVirtualsRoutes(config, providerName) {
  if (!config.Router || typeof config.Router !== "object") return;
  for (const [key, value] of Object.entries(config.Router)) {
    if (typeof value === "string" && value.startsWith(`${providerName},`)) {
      delete config.Router[key];
    }
  }
}

function cleanupEmptyContainers(config, state) {
  if (Array.isArray(config.Providers) && config.Providers.length === 0 && !state.hadProviders) {
    delete config.Providers;
  }

  if (config.Router && typeof config.Router === "object" && Object.keys(config.Router).length === 0 && !state.hadRouter) {
    delete config.Router;
  }
}

function findProvider(providers, name) {
  return Array.isArray(providers) ? providers.find((provider) => provider?.name === name) : undefined;
}

function isEmptyConfig(config) {
  return Object.keys(config).length === 0;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function unique(values) {
  return [...new Set(values)];
}

function parseEnvReference(value) {
  const match = String(value).match(/^\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))$/);
  return match ? match[1] || match[2] : null;
}

function ensureTrailingNewline(text) {
  return text.endsWith("\n") ? text : `${text}\n`;
}
