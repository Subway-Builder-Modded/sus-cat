import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("bounded purge", () => {
  it("bounds channel traversal, scan depth, and API batch size", async () => {
    const source = await readFile(new URL("../src/modules/moderation/services/channel-moderation-service.ts", import.meta.url), "utf8");
    expect(source).toContain("channels.slice(0, 50)");
    expect(source).toContain("scanned < scanLimit");
    expect(source).toContain("chunk([...messages.values()], 100)");
  });
});
