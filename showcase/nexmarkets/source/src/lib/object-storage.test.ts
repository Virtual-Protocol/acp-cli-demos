import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { absoluteObjectPath, deleteObject, readObject, writeObject } from "./object-storage";

describe("object storage", () => {
  it("keeps local development objects private, scoped, and removable", async () => {
    const key = `tests/${randomUUID()}/artifact.txt`;
    try {
      await writeObject(key, "persisted artifact", { contentType: "text/plain", exclusive: true });
      await expect(readObject(key)).resolves.toEqual(Buffer.from("persisted artifact"));
      expect(absoluteObjectPath(key)).toContain("data");
    } finally {
      await deleteObject(key).catch(() => null);
    }
  });

  it("rejects traversal before an object-store request can be made", () => {
    expect(() => absoluteObjectPath("../private-key.txt")).toThrow("Object key is invalid");
    expect(() => absoluteObjectPath("/absolute/private-key.txt")).toThrow("Object key is invalid");
  });
});
