import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyHeyGenWebhook } from "./webhook";

describe("HeyGen callback verification", () => {
  it("accepts only the HMAC for the exact raw body", () => {
    const body = JSON.stringify({ callback_id: "a", status: "completed" });
    const secret = "test-secret";
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyHeyGenWebhook(body, `sha256=${signature}`, secret)).toBe(true);
    expect(verifyHeyGenWebhook(`${body} `, `sha256=${signature}`, secret)).toBe(false);
  });
});
