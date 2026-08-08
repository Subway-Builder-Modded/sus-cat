import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../command.js";
import { moderation, requireGuildInteraction, requireTargetMember } from "../../../moderation/interactions/context.js";
import { replyWithCase } from "../../../moderation/interactions/replies.js";
import { MAX_TIMEOUT_MS, parseDuration } from "../../../moderation/utils/duration.js";

export default {
  data: new SlashCommandBuilder().setName("timeout").setDescription("Temporarily restrict a member")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName("user").setDescription("Member to time out").setRequired(true))
    .addStringOption((option) => option.setName("duration").setDescription("Examples: 10m, 2h, 7d").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason").setMaxLength(1_000).setRequired(true)),
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const target = await requireTargetMember(interaction);
    const duration = parseDuration(interaction.options.getString("duration", true), MAX_TIMEOUT_MS);
    const item = await moderation(client).moderation.timeout({ guild, actor, target, idempotencyKey: interaction.id, reason: interaction.options.getString("reason", true) }, duration);
    await replyWithCase(interaction, item);
  },
} satisfies BotCommand;
