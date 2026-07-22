import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function run() {
  try {
    const path = resolve(process.cwd(), "node_modules", "gsap", "dist", "gsap.min.js");
    console.log("Gsap path:", path);
    const content = await readFile(path, "utf8");
    console.log("Gsap read successfully! Length:", content.length);
  } catch (error) {
    console.error("Failed to read gsap.min.js:", error);
  }
}

run().catch(console.error);
