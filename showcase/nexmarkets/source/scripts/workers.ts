import "dotenv/config";
import { runWorkersOnce } from "../src/lib/workers";

const watch = process.argv.includes("--watch");

async function run() {
  const result = await runWorkersOnce();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

await run();
while (watch) {
  await new Promise((resolve) => setTimeout(resolve, 15_000));
  await run();
}
