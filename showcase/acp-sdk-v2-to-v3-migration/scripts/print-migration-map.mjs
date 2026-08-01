#!/usr/bin/env node
import {
  PHASE_TO_EVENT,
  ACTION_TABLE,
  INIT_TABLE,
} from "../examples/phase-event-map.mjs";

function table(rows, columns) {
  const widths = columns.map((c) =>
    Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)),
  );
  const line = (vals) =>
    vals.map((v, i) => String(v).padEnd(widths[i])).join("  |  ");
  const out = [];
  out.push(line(columns));
  out.push(widths.map((w) => "-".repeat(w)).join("-+-"));
  for (const row of rows) out.push(line(columns.map((c) => row[c] ?? "")));
  return out.join("\n");
}

console.log("ACP SDK v2 → v3 migration map\n");
console.log("Phases → Events");
console.log(
  table(PHASE_TO_EVENT, ["v2Phase", "v3Event", "nextActor"]),
);
console.log("\nJob actions");
console.log(table(ACTION_TABLE, ["action", "v2", "v3"]));
console.log("\nInitialization");
console.log(table(INIT_TABLE, ["concern", "v2", "v3"]));
