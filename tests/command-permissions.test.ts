import { describe, expect, it } from "vitest";

import { createBotClient } from "../src/core/bot/create-client.js";
import { loadCommands } from "../src/core/commands/load-commands.js";

describe("dynamic command permissions", () => {
  it("does not use static default_member_permissions that hide configured role bypasses", async () => {
    const client = createBotClient(); await loadCommands(client);
    for (const name of ["ban", "kick", "timeout", "warn", "nickname", "slowmode", "sudo", "case"]) expect(client.commands.get(name)?.data.toJSON().default_member_permissions).toBeUndefined();
    client.destroy();
  });
});
