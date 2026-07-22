import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
for (const output of ["prisma", "sqlite"]) {
  await rm(resolve(root, "src", "generated", output), { recursive: true, force: true });
}
