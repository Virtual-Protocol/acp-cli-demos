import { describe, expect, it } from "vitest";
import { assertProductionTransition, canTransitionProduction, publicProductionState } from "./production";

describe("production state machine", () => {
  it("allows the paid infographic path to queue", () => {
    expect(canTransitionProduction("PAID", "QUEUED")).toBe(true);
    expect(publicProductionState("RENDERING")).toBe("producing");
  });

  it("rejects skipping payment", () => {
    expect(() => assertProductionTransition("DIRECTION_READY", "QUEUED")).toThrow(
      "DIRECTION_READY -> QUEUED"
    );
  });
});
