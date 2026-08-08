import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction, requireTargetMember } from "../interactions/context.js";
import { replyPrivately } from "../interactions/replies.js";
import { confirmationButtons } from "../ui/confirmation.js";
import { confirmationEmbed } from "../ui/responses.js";
import { formatDuration, parseDuration } from "../utils/duration.js";

export default {
  data: new SlashCommandBuilder().setName("ban").setDescription("Ban a member after explicit confirmation")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) => option.setName("user").setDescription("Member to ban").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason").setMaxLength(1_000).setRequired(true))
    .addIntegerOption((option) => option.setName("delete-hours").setDescription("Hours of messages to delete").setMinValue(0).setMaxValue(168))
    .addStringOption((option) => option.setName("duration").setDescription("Optional temporary ban duration")),
  requirements: { moduleId: "moderation", featureId: "bans", capability: "moderation.ban", guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const target = await requireTargetMember(interaction);
    const reason = interaction.options.getString("reason", true);
    const durationText = interaction.options.getString("duration");
    const durationMs = durationText ? parseDuration(durationText, 365 * 86_400_000) : undefined;
    const summary = await moderation(client).cases.summary(guild.id, target.id);
    const token = moderation(client).confirmations.create({ type: "ban", guildId: guild.id, actorId: actor.id, targetId: target.id, reason, deleteSeconds: (interaction.options.getInteger("delete-hours") ?? 0) * 3_600, ...(durationMs ? { durationMs } : {}), idempotencyKey: interaction.id });
    await replyPrivately(interaction, { embeds: [confirmationEmbed("Confirm Ban", `${target} \`${target.id}\`\n\n**Reason**\n${reason}\n\n**History**\n${summary.warnings} warnings • ${summary.timeouts} timeouts • ${summary.bans} bans${durationMs ? `\n\n**Duration**\n${formatDuration(durationMs)}` : ""}`)], components: [confirmationButtons(token)] });
  },
} satisfies BotCommand;
