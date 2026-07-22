import { spawn } from "node:child_process";
import process from "node:process";

const nextArgs = ["next", "dev", ...process.argv.slice(2)];
const nextCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const children = [];
let shuttingDown = false;

function start(name, command, args) {
  const child = spawn(command, args, { stdio: "inherit", env: process.env });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const item of children) if (item !== child && !item.killed) item.kill("SIGTERM");
    if (code && code !== 0) process.exitCode = code;
    if (signal) console.log(`[dev] ${name} exited with ${signal}`);
  });
}

function stop() {
  shuttingDown = true;
  for (const child of children) if (!child.killed) child.kill("SIGTERM");
}

process.on("SIGINT", () => { stop(); process.exit(130); });
process.on("SIGTERM", () => { stop(); process.exit(143); });

start("Gemini Live bridge", process.execPath, ["scripts/gemini-live-bridge.mjs"]);
start("Next dev", nextCommand, nextArgs);
