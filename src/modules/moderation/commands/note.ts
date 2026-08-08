import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction, requireTargetMember } from "../interactions/context.js";
import { replyWithCase } from "../interactions/replies.js";

export default {
  data: new SlashCommandBuilder().setName("note").setDescription("Add a private staff note about a member")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption((option) => option.setName("user").setDescription("Member").setRequired(true))
    .addStringOption((option) => option.setName("content").setDescription("Private note").setMaxLength(1_000).setRequired(true)),
  requirements: { moduleId: "moderation", featureId: "notes", capability: "moderation.note", guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const target = await requireTargetMember(interaction);
    const item = await moderation(client).moderation.note({ guild, actor, target, idempotencyKey: interaction.id, reason: interaction.options.getString("content", true) });
    await replyWithCase(interaction, item);
  },
} satisfies BotCommand;
