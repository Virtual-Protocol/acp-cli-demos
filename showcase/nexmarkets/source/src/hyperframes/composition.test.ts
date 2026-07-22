import { describe, expect, it } from "vitest";
import { buildComposition } from "./composition";

describe("HyperFrames bundle", () => {
  it("builds a local-asset, exact 30-second composition", async () => {
    const bundle = await buildComposition({
      productionId: "01980f31-62fa-7cc1-89bb-d831d07195af",
      title: "Northstar launch",
      message: "Make the product clear from the opening frame.",
      callToAction: "Start with NexMind",
      aspectRatio: "16:9",
      durationSeconds: 30
    });
    const html = String(bundle.files["index.html"]);
    expect(bundle.durationSeconds).toBe(30);
    expect(bundle.hyperframesVersion).toBe("0.7.56");
    expect(html).toContain('data-duration="30"');
    expect(html).toContain('./assets/gsap.min.js');
    expect(bundle.files["assets/gsap.min.js"]).toBeTruthy();
    expect(bundle.manifest.compositionHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
