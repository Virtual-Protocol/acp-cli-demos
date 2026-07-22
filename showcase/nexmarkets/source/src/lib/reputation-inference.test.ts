import { describe, expect, it } from "vitest";
import { normaliseReputationPayload } from "./reputation-inference";

describe("reputation inference normalisation", () => {
  it("falls back when NexMind returns empty required strings", () => {
    const payload = normaliseReputationPayload({
      identity: {
        name: "",
        username: "",
        profile_image_url: "",
        location: "",
        description: "",
        public_metrics: {},
      },
      analysis: {
        windowDays: 90,
        tweetsChecked: 0,
        activeDays: 0,
        totals: { impressions: 0, likes: 0, replies: 0, reposts: 0, quotes: 0 },
        weeklyReach: [],
        topics: [],
        standout: [],
        workSignature: "",
        capabilities: [{ label: "", evidenceCount: 3 }, { label: "AI", evidenceCount: 2 }],
        selectedWork: [{ title: "", role: "Builder" }, { title: "Agent launch", role: "" }],
        activity: [{ month: "", intensity: 3 }, { month: "Jul", intensity: 9 }],
        network: [{ name: "", relation: "peer" }, { name: "NexMarkets", relation: "community" }],
        desiredWork: ["", "Product strategy"],
        availability: "",
        analysedAt: "",
      },
    }, "KamliMary");

    expect(payload.identity.name).toBe("KamliMary");
    expect(payload.identity.username).toBe("KamliMary");
    expect(payload.analysis.workSignature).toBe("Public X activity from @KamliMary");
    expect(payload.analysis.capabilities).toEqual([{ label: "AI", evidenceCount: 2, confirmed: false }]);
    expect(payload.analysis.selectedWork).toEqual([{ title: "Agent launch", role: undefined, proofUrl: undefined }]);
    expect(payload.analysis.activity).toEqual([{ month: "Jul", intensity: 4 }]);
    expect(payload.analysis.network).toEqual([{ name: "NexMarkets", relation: "community", avatarUrl: undefined }]);
    expect(payload.analysis.desiredWork).toEqual(["Product strategy"]);
    expect(Date.parse(payload.analysis.analysedAt)).not.toBeNaN();
  });
});
