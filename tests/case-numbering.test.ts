import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("case number allocation contract", () => {
  it("uses an atomic per-guild upsert rather than MAX + 1", async () => {
    const source = await readFile(new URL("../src/modules/moderation/repositories/case-repository.ts", import.meta.url), "utf8");
    expect(source).toContain("INSERT INTO moderation_guild_case_counters");
    expect(source).toContain("ON CONFLICT (guild_id) DO UPDATE");
    expect(source).not.toMatch(/SELECT\s+MAX/i);
  });
});
