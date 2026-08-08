import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction, requireTargetMember } from "../interactions/context.js";
import { replyWithCase } from "../interactions/replies.js";

export default {
  data: new SlashCommandBuilder().setName("kick").setDescription("Remove a member from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) => option.setName("user").setDescription("Member to kick").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason").setMaxLength(1_000).setRequired(true)),
  requirements: { moduleId: "moderation", featureId: "kicks", capability: "moderation.kick", guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const target = await requireTargetMember(interaction);
    const item = await moderation(client).moderation.kick({ guild, actor, target, idempotencyKey: interaction.id, reason: interaction.options.getString("reason", true) });
    await replyWithCase(interaction, item);
  },
} satisfies BotCommand;
