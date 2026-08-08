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
  it("groups legacy action cases into user cases and retires executable automation", async () => {
    const sql = await readFile(new URL("../drizzle/0002_user_cases.sql", import.meta.url), "utf8");
    expect(sql).toContain('GROUP BY "guild_id","target_user_id"');
    expect(sql).toContain('INSERT INTO "moderation_case_entries"');
    expect(sql).toContain("legacyEvidenceType");
    expect(sql).toContain('DROP TABLE "moderation_scheduled_actions"');
    expect(sql).toContain('CREATE TABLE "moderation_action_receipts"');
    expect(sql).not.toMatch(/TRUNCATE|DROP DATABASE/i);
  });
  it("merges legacy moderation and audit logs without losing the configured channel", async () => {
    const sql = await readFile(new URL("../drizzle/0003_unified_audit_log.sql", import.meta.url), "utf8");
    expect(sql).toContain("moderationLogChannelId");
    expect(sql).toContain("auditLogChannelId");
    expect(sql).toContain("bool_or");
    expect(sql).toContain("'moderation-log'");
    expect(sql).not.toMatch(/TRUNCATE|DROP DATABASE/i);
  });
});
