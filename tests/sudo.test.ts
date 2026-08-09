import { PermissionFlagsBits } from "discord.js";
import { describe, expect, it } from "vitest";

import sudo from "../src/modules/moderation/commands/sudo.js";
import { moderationManifest } from "../src/modules/moderation/manifest.js";

describe("sudo command", () => {
  it("registers a required message, optional channel, and dynamic Manage Server authorization", () => {
    const command = sudo.data.toJSON();
    expect(command.options?.map((option) => ({ name: option.name, required: "required" in option ? option.required : undefined }))).toEqual([
      { name: "message", required: true },
      { name: "channel", required: false },
    ]);
    expect(sudo.requirements.nativeUserPermission).toBe(PermissionFlagsBits.ManageGuild);
    expect(sudo.requirements.featureId).toBe("sudo");
    expect(command.default_member_permissions).toBeUndefined();
  });

  it("is independently toggleable and declares the bot permissions it needs", () => {
    const feature = moderationManifest.features.find((item) => item.id === "sudo");
    expect(feature?.defaultEnabled).toBe(false);
    expect(feature?.requiredBotPermissions).toEqual([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]);
  });
});
