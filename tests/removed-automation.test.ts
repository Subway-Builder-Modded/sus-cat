import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("removed moderation automation", () => {
  it("does not register notes, softbans, temporary bans, or a scheduler", async () => {
    const commands = await readFile(new URL("../src/modules/moderation/commands/index.ts", import.meta.url), "utf8");
    const manifest = await readFile(new URL("../src/modules/moderation/manifest.ts", import.meta.url), "utf8");
    expect(commands).not.toMatch(/note|softban|history|\bmod\b/i);
    expect(manifest).not.toMatch(/temporary-bans|softbans|staff notes/i);
    expect(await readdir(new URL("../src/modules/moderation/services/", import.meta.url))).not.toContain("expiration-service.ts");
  });
});
