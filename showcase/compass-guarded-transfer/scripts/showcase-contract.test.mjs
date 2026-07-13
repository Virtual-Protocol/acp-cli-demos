import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { auditPublicClaims } from "./audit-public-claims.mjs";

const root = new URL("../../..", import.meta.url).pathname;
const packageDir = join(root, "showcase/compass-guarded-transfer");
const validator = join(root, "scripts/validate-showcase.mjs");

test("rejects this package's required invalid manifest constraints", async () => {
  for (const mutate of [
    (manifest) => ({ ...manifest, slug: "wrong-slug" }),
    (manifest) => ({ ...manifest, primitives: ["wallet", "unsupported"] }),
    (manifest) => ({ ...manifest, skills: [{ ...manifest.skills[0], sourcePath: "../outside" }] }),
    (manifest) => ({ ...manifest, artifacts: [] }),
    (manifest) => ({ ...manifest, feedbackPrompts: manifest.feedbackPrompts.slice(0, 2) }),
  ]) {
    const temp = await mkdtemp(join(tmpdir(), "compass-showcase-"));
    try {
      await cp(packageDir, join(temp, "showcase/compass-guarded-transfer"), { recursive: true });
      const file = join(temp, "showcase/compass-guarded-transfer/showcase.json");
      const manifest = mutate(JSON.parse(await readFile(file, "utf8")));
      await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`);
      const result = spawnSync(process.execPath, [validator], { cwd: temp, encoding: "utf8" });
      assert.notEqual(result.status, 0);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }
});

test("audits public copy for advisory, bypassable claims only", async () => {
  const texts = await Promise.all([
    readFile(join(packageDir, "showcase.json"), "utf8"),
    readFile(join(packageDir, "skills/compass-guarded-transfer/SKILL.md"), "utf8"),
    readFile(join(packageDir, "proof/README.md"), "utf8"),
  ]);
  assert.deepEqual(auditPublicClaims(texts), []);
});
