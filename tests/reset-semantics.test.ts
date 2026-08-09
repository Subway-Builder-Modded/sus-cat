import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("reset semantics", () => {
  it("keeps case reset module-local and makes resetsetup invoke module hooks transactionally", async () => {
    const [moderationReset, configRepository, configService, setup] = await Promise.all([
      readFile(new URL("../src/modules/moderation/repositories/reset-repository.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/core/config/repository.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/core/config/service.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/core/setup/handler.ts", import.meta.url), "utf8"),
    ]);
    expect(moderationReset).toContain("resetModerationCases");
    expect(moderationReset).toContain("guildCaseCounters");
    expect(moderationReset).not.toContain("guildSettings");
    expect(configRepository).toContain("this.db.transaction");
    expect(configRepository).toContain("transaction.delete(guildSettings)");
    expect(configService).toContain("module.resetGuild");
    expect(setup).toContain("settings.resetGuild");
    expect(setup).not.toContain("drizzle-orm");
  });
});
