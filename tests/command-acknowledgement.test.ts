import { Collection, SlashCommandBuilder } from "discord.js";
import { describe, expect, it, vi } from "vitest";

import type { BotCommand } from "../src/core/commands/command.js";
import { dispatchCommand } from "../src/core/commands/dispatcher.js";

function interaction() {
  const target = { id: "interaction", guildId: "guild", user: { id: "user" }, commandName: "long", deferred: false, replied: false, deferReply: vi.fn(async () => { target.deferred = true; }), reply: vi.fn(async () => { target.replied = true; }), editReply: vi.fn(async () => { target.replied = true; }), followUp: vi.fn() };
  return target;
}

function client(command: BotCommand) {
  return { commands: new Collection([["long", command]]), platform: { settings: { setupStatus: async () => "configured", configurationIssues: async () => [] } } } as never;
}

describe("command acknowledgement", () => {
  it("defers long-running commands before invoking their handler", async () => {
    const target = interaction();
    const execute = vi.fn(async () => { expect(target.deferReply).toHaveBeenCalledOnce(); });
    const command = { data: new SlashCommandBuilder().setName("long").setDescription("test"), requirements: { acknowledgement: "defer-ephemeral", guildOnly: true, setupRequired: false }, execute } satisfies BotCommand;
    await dispatchCommand(client(command), target as never);
    expect(execute).toHaveBeenCalledOnce();
  });

  it("does not pre-defer modal commands", async () => {
    const target = interaction();
    const execute = vi.fn();
    const command = { data: new SlashCommandBuilder().setName("long").setDescription("test"), requirements: { acknowledgement: "modal", guildOnly: true, setupRequired: false }, execute } satisfies BotCommand;
    await dispatchCommand(client(command), target as never);
    expect(target.deferReply).not.toHaveBeenCalled();
  });

  it("renders errors after defer by editing the initial response", async () => {
    const target = interaction();
    const command = { data: new SlashCommandBuilder().setName("long").setDescription("test"), requirements: { acknowledgement: "defer-ephemeral", guildOnly: true, setupRequired: false }, execute: async () => { throw new Error("boom"); } } satisfies BotCommand;
    await dispatchCommand(client(command), target as never);
    expect(target.editReply).toHaveBeenCalledOnce();
    expect(target.followUp).not.toHaveBeenCalled();
  });
});
