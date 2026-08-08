import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("user-centric case model", () => {
  it("enforces one case per guild/user and stores actions as chronological entries without case status", async () => {
    const schema = await readFile(new URL("../src/modules/moderation/database/schema.ts", import.meta.url), "utf8");
    expect(schema).toContain('uniqueIndex("moderation_user_cases_guild_target_unique")');
    expect(schema).toContain('index("moderation_case_entries_timeline_idx")');
    expect(schema).not.toContain("moderationCaseStatus");
    expect(schema).not.toContain("scheduled");
  });
  it("serializes concurrent first actions and uses entry idempotency", async () => {
    const repository = await readFile(new URL("../src/modules/moderation/repositories/case-repository.ts", import.meta.url), "utf8");
    expect(repository).toContain("pg_advisory_xact_lock");
    expect(repository).toContain("idempotencyKey");
    expect(repository).toContain("moderationUserCases");
  });
});
