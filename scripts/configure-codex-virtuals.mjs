#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const DEFAULT_PROVIDER = "virtuals_proxy";
const DEFAULT_MODEL = "gpt-5.5";
const DEFAULT_CODEX_MODEL = "gpt-5.5";
const DEFAULT_BASE_URL = "http://127.0.0.1:8787/v1";
const LEGACY_VIRTUALS_MODEL_TO_CODEX_MODEL = new Map([
  ["openai-gpt-55", "gpt-5.5"],
  ["openai-gpt-54-mini", "gpt-5.4-mini"],
]);

const options = parseArgs(process.argv.slice(2));
const configPath = expandPath(options.config || "~/.codex/config.toml");
const statePath = `${configPath}.virtuals-state.json`;
const backupPath = `${configPath}.before-virtuals.bak`;

if (options.help) {
  usage();
  process.exit(0);
}

if (options.mode === "restore") {
  restoreConfig();
} else if (options.mode === "default") {
  switchToDefaultCodex();
} else {
  configureConfig();
}

function usage() {
  console.log(`Usage: scripts/configure-codex-virtuals.mjs [virtuals|restore|default] [options]

Activates or restores Codex model routing through the local Virtuals Responses proxy.

Commands:
  virtuals              Switch Codex to the local Virtuals proxy (default)
  restore               Restore the pre-Virtuals active model/provider
  default               Switch Codex back to built-in provider routing

Options:
  --config PATH          Codex config path (default: ~/.codex/config.toml)
  --model MODEL          Codex model id (default: ${DEFAULT_MODEL})
  --default-model MODEL  Built-in Codex model for default mode (default: ${DEFAULT_CODEX_MODEL})
  --provider NAME        Codex provider name (default: ${DEFAULT_PROVIDER})
  --base-url URL         Local proxy base URL (default: ${DEFAULT_BASE_URL})
  --env-key NAME         Optional env var name for local proxy auth
  --add-provider-only    Add/update the provider block without switching model/provider
  --default              Alias for the default command
  --restore              Restore the pre-Virtuals active model/provider
  -h, --help             Show this help
`);
}

function parseArgs(args) {
  const parsed = {
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    defaultModel: DEFAULT_CODEX_MODEL,
    baseUrl: DEFAULT_BASE_URL,
    envKey: undefined,
    addProviderOnly: false,
    mode: "virtuals",
    help: false,
    config: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "virtuals":
      case "restore":
      case "default":
        parsed.mode = arg;
        break;
      case "--config":
        parsed.config = requiredValue(args, (index += 1), arg);
        break;
      case "--model":
        parsed.model = requiredValue(args, (index += 1), arg);
        break;
      case "--default-model":
        parsed.defaultModel = requiredValue(args, (index += 1), arg);
        break;
      case "--provider":
        parsed.provider = requiredValue(args, (index += 1), arg);
        break;
      case "--base-url":
        parsed.baseUrl = requiredValue(args, (index += 1), arg);
        break;
      case "--env-key":
        parsed.envKey = requiredValue(args, (index += 1), arg);
        break;
      case "--add-provider-only":
        parsed.addProviderOnly = true;
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

  assertBareKey(parsed.provider, "--provider");
  if (parsed.envKey) assertEnvKey(parsed.envKey);
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

function assertBareKey(value, flag) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    fail(`${flag} must be a TOML bare key: letters, numbers, underscores, or dashes`);
  }
}

function assertEnvKey(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    fail("--env-key must be a valid environment variable name");
  }
}

function readConfig() {
  return existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
}

function writeConfig(next) {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, ensureTrailingNewline(next), { mode: 0o600 });
}

function configureConfig() {
  const original = readConfig();
  let next = original;
  const model = codexModelId(options.model);

  if (!options.addProviderOnly) {
    captureRestoreState(original);
    next = setTopLevelKey(next, "model", model);
    next = setTopLevelKey(next, "model_provider", options.provider);
  }

  next = upsertProviderBlock(next, options.provider, providerBlock());
  if (next === original) {
    console.log(`Codex config already routes through ${options.provider}.`);
    return;
  }

  writeBackupIfMissing(original);
  writeConfig(next);
  console.log(`Updated ${configPath}`);
  if (!options.addProviderOnly) {
    if (model !== options.model) {
      console.log(
        `Normalized model ${options.model} to Codex-compatible ${model}. The local proxy maps it upstream.`,
      );
    }
    console.log(`Active model: ${model}`);
    console.log(`Active provider: ${options.provider}`);
    console.log(`Restore with: scripts/configure-codex-virtuals.mjs restore`);
  }
}

function codexModelId(model) {
  return LEGACY_VIRTUALS_MODEL_TO_CODEX_MODEL.get(model) || model;
}

function restoreConfig() {
  if (!existsSync(statePath)) {
    fail(
      `No Virtuals state file found at ${statePath}. Use "scripts/configure-codex-virtuals.mjs default" to switch back to built-in Codex routing.`,
    );
  }

  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const original = readConfig();
  let next = original;
  const provider = state.provider || options.provider;

  next =
    state.providerBlock == null
      ? removeSection(next, providerSectionName(provider))
      : upsertProviderBlock(next, provider, state.providerBlock);

  next = state.hadModel
    ? setTopLevelKey(next, "model", state.model)
    : removeTopLevelKey(next, "model");
  next = state.hadModelProvider
    ? setTopLevelKey(next, "model_provider", state.modelProvider)
    : removeTopLevelKey(next, "model_provider");

  if (state.hadModelCatalogJson) {
    next = setTopLevelKey(next, "model_catalog_json", state.modelCatalogJson);
  } else {
    next = removeTopLevelKey(next, "model_catalog_json");
  }

  if (next !== original) {
    writeBackupIfMissing(original);
    writeConfig(next);
  }

  rmSync(statePath, { force: true });
  console.log(`Restored Codex config from ${statePath}`);
}

function switchToDefaultCodex() {
  const original = readConfig();
  let next = original;

  next = removeSection(next, providerSectionName(options.provider));
  next = setTopLevelKey(next, "model", options.defaultModel);
  next = removeTopLevelKey(next, "model_provider");
  next = removeTopLevelKey(next, "model_catalog_json");

  if (next !== original) {
    writeBackupIfMissing(original);
    writeConfig(next);
  }

  rmSync(statePath, { force: true });
  console.log(`Switched Codex back to built-in provider routing with model ${options.defaultModel}.`);
}

function captureRestoreState(text) {
  // Snapshot the config exactly as it is on disk right now, overwriting any
  // previous snapshot. `restore` then always returns to the state immediately
  // before the most recent activation. Capturing only once (the old behavior)
  // left the snapshot stale whenever the config was edited between activations,
  // so restore silently reverted those edits away. The genuine pre-Virtuals
  // baseline is preserved separately in `.before-virtuals.bak`.
  const provider = options.provider;
  const state = {
    createdAt: new Date().toISOString(),
    provider,
    hadModel: hasTopLevelKey(text, "model"),
    model: getTopLevelValue(text, "model"),
    hadModelProvider: hasTopLevelKey(text, "model_provider"),
    modelProvider: getTopLevelValue(text, "model_provider"),
    hadModelCatalogJson: hasTopLevelKey(text, "model_catalog_json"),
    modelCatalogJson: getTopLevelValue(text, "model_catalog_json"),
    providerBlock: extractSection(text, providerSectionName(provider)),
  };

  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function writeBackupIfMissing(text) {
  if (!text || existsSync(backupPath)) return;
  writeFileSync(backupPath, ensureTrailingNewline(text), { mode: 0o600 });
}

function providerBlock() {
  const lines = [
    `[${providerSectionName(options.provider)}]`,
    `name = ${tomlString("Virtuals via local Responses proxy")}`,
    `base_url = ${tomlString(options.baseUrl)}`,
    `wire_api = "responses"`,
  ];

  if (options.envKey) {
    lines.push(`env_key = ${tomlString(options.envKey)}`);
  }

  return `${lines.join("\n")}\n`;
}

function providerSectionName(provider) {
  return `model_providers.${provider}`;
}

function tomlString(value) {
  return JSON.stringify(value);
}

function ensureTrailingNewline(text) {
  return text.endsWith("\n") ? text : `${text}\n`;
}

function splitLines(text) {
  return ensureTrailingNewline(text).split("\n").slice(0, -1);
}

function setTopLevelKey(text, key, value) {
  const lines = splitLines(text);
  const keyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`);
  const commentedKeyPattern = new RegExp(`^\\s*#\\s*${escapeRegExp(key)}\\s*=`);
  let inRoot = true;
  let firstSectionIndex = lines.length;
  let updated = false;
  const next = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (isSectionHeader(line)) {
      inRoot = false;
      firstSectionIndex = Math.min(firstSectionIndex, index);
    }

    if (inRoot && keyPattern.test(line)) {
      next.push(`${key} = ${tomlString(value)}`);
      updated = true;
      continue;
    }

    if (inRoot && commentedKeyPattern.test(line)) {
      if (!updated) {
        next.push(`${key} = ${tomlString(value)}`);
        updated = true;
      }
      continue;
    }

    next.push(line);
  }

  if (!updated) {
    next.splice(firstSectionIndex, 0, `${key} = ${tomlString(value)}`);
  }

  return `${next.join("\n")}\n`;
}

function removeTopLevelKey(text, key) {
  const keyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`);
  const commentedKeyPattern = new RegExp(`^\\s*#\\s*${escapeRegExp(key)}\\s*=`);
  const lines = splitLines(text);
  let inRoot = true;
  const next = [];

  for (const line of lines) {
    if (isSectionHeader(line)) inRoot = false;
    if (inRoot && (keyPattern.test(line) || commentedKeyPattern.test(line))) continue;
    next.push(line);
  }

  return `${next.join("\n")}\n`;
}

function hasTopLevelKey(text, key) {
  return getTopLevelValue(text, key) != null;
}

function getTopLevelValue(text, key) {
  const keyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=\\s*(.+?)\\s*$`);
  let inRoot = true;

  for (const line of splitLines(text)) {
    if (isSectionHeader(line)) inRoot = false;
    if (!inRoot) continue;

    const match = line.match(keyPattern);
    if (!match) continue;
    return parseTomlString(match[1]);
  }

  return undefined;
}

function parseTomlString(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value.replace(/^['"]|['"]$/g, "");
  }
}

function upsertProviderBlock(text, provider, block) {
  const withoutBlock = removeSection(text, providerSectionName(provider)).replace(/\n{3,}$/g, "\n\n");
  return `${withoutBlock.trimEnd()}\n\n${block}`;
}

function extractSection(text, sectionName) {
  const lines = splitLines(text);
  const start = findSectionStart(lines, sectionName);
  if (start === -1) return null;

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (isSectionHeader(lines[index])) {
      end = index;
      break;
    }
  }

  return `${lines.slice(start, end).join("\n")}\n`;
}

function removeSection(text, sectionName) {
  const lines = splitLines(text);
  const start = findSectionStart(lines, sectionName);
  if (start === -1) return ensureTrailingNewline(text);

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (isSectionHeader(lines[index])) {
      end = index;
      break;
    }
  }

  lines.splice(start, end - start);
  return `${lines.join("\n")}\n`;
}

function findSectionStart(lines, sectionName) {
  const header = `[${sectionName}]`;
  return lines.findIndex((line) => line.trim() === header);
}

function isSectionHeader(line) {
  return /^\s*\[[^\]]+\]\s*$/.test(line);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
