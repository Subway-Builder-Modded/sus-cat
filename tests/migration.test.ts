import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("modular platform migration", () => {
  it("preserves moderation records and migrates legacy configuration without assuming setup completion", async () => {
    const sql = await readFile(new URL("../drizzle/0001_modular_platform.sql", import.meta.url), "utf8");
    expect(sql).toContain('CREATE TABLE "guild_settings"');
    expect(sql).toContain('FROM "moderation_configs"');
    expect(sql).toContain("'unconfigured'");
    expect(sql).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM/i);
  });
});
