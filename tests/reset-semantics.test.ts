import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("reset semantics", () => {
  it("keeps case reset module-local and makes resetsetup invoke module hooks transactionally", async () => {
    const repository = await readFile(new URL("../src/modules/moderation/repositories/case-repository.ts", import.meta.url), "utf8");
    const setup = await readFile(new URL("../src/core/setup/handler.ts", import.meta.url), "utf8");
    expect(repository).toContain("resetModerationCases");
    expect(repository).toContain("guildCaseCounters");
    expect(repository).not.toContain("guildSettings");
    expect(setup).toContain("database.db.transaction");
    expect(setup).toContain("module.resetGuild");
    expect(setup).toContain("tx.delete(guildSettings)");
  });
});
