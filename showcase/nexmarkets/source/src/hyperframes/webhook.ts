import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyHeyGenWebhook(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const supplied = signature.replace(/^sha256=/i, "").trim();
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"));
}
