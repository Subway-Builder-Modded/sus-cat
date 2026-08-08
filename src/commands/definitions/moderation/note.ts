import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../command.js";
import { moderation, requireGuildInteraction, requireTargetMember } from "../../../moderation/interactions/context.js";
import { replyWithCase } from "../../../moderation/interactions/replies.js";

export default {
  data: new SlashCommandBuilder().setName("note").setDescription("Add a private staff note about a member")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption((option) => option.setName("user").setDescription("Member").setRequired(true))
    .addStringOption((option) => option.setName("content").setDescription("Private note").setMaxLength(1_000).setRequired(true)),
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const target = await requireTargetMember(interaction);
    const item = await moderation(client).moderation.note({ guild, actor, target, idempotencyKey: interaction.id, reason: interaction.options.getString("content", true) });
    await replyWithCase(interaction, item);
  },
} satisfies BotCommand;
