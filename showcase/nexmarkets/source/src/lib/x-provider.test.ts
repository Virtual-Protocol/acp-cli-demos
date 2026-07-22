import { afterEach, describe, expect, it, vi } from "vitest";
import { analyseXTweets } from "./x-provider";

afterEach(() => vi.useRealTimers());

describe("X evidence analysis", () => {
  it("uses only the real 90-day window and builds chronological weekly reach", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T12:00:00.000Z"));
    const analysis = analyseXTweets([
      { id: "recent", text: "Product research research launch", created_at: "2026-07-13T10:00:00.000Z", public_metrics: { impression_count: 100, like_count: 8 } },
      { id: "week-old", text: "Design systems research", created_at: "2026-07-05T12:00:00.000Z", public_metrics: { impression_count: 50, reply_count: 3 } },
      { id: "old", text: "This must be excluded", created_at: "2026-03-01T12:00:00.000Z", public_metrics: { impression_count: 9_999 } },
      { id: "future", text: "This must also be excluded", created_at: "2026-07-14T12:00:00.000Z", public_metrics: { impression_count: 9_999 } },
    ]);
    expect(analysis.tweetsChecked).toBe(2);
    expect(analysis.totals.impressions).toBe(150);
    expect(analysis.weeklyReach).toHaveLength(13);
    expect(analysis.weeklyReach[12]).toBe(100);
    expect(analysis.weeklyReach[11]).toBe(50);
    expect(analysis.topics[0]).toEqual({ name: "research", count: 3 });
    expect(analysis.standout.map((post) => post.id)).toEqual(["recent", "week-old"]);
  });
});
