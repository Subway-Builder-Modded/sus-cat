import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction, requireTargetMember } from "../interactions/context.js";
import { replyWithOutcome } from "../interactions/replies.js";
import { MAX_TIMEOUT_MS, parseDuration } from "../utils/duration.js";
import { attachActionEvidence, requireActionEvidenceEnabled } from "../interactions/action-evidence.js";

export default {
  data: new SlashCommandBuilder().setName("timeout").setDescription("Temporarily restrict a member")
    .addUserOption((option) => option.setName("user").setDescription("Member to time out").setRequired(true))
    .addStringOption((option) => option.setName("duration").setDescription("Examples: 10m, 2h, 7d").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason").setMaxLength(1_000).setRequired(true))
    .addBooleanOption((option) => option.setName("silent").setDescription("Skip case history and user notification"))
    .addStringOption((option) => option.setName("evidence").setDescription("Optional evidence text or link").setMaxLength(1_000)),
  requirements: { moduleId: "moderation", featureId: "timeouts", nativeUserPermission: PermissionFlagsBits.ModerateMembers, guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction), target = await requireTargetMember(interaction);
    const reason = interaction.options.getString("reason", true), durationMs = parseDuration(interaction.options.getString("duration", true), MAX_TIMEOUT_MS), silent = interaction.options.getBoolean("silent") ?? false, evidence = interaction.options.getString("evidence");
    await requireActionEvidenceEnabled(client, guild.id, evidence, silent);
    const outcome = await moderation(client).moderation.timeout({ guild, actor, target, reason, silent, idempotencyKey: interaction.id }, durationMs);
    const isEvidenceAttached = await attachActionEvidence(client, { guildId: guild.id, actorId: actor.id, interactionId: interaction.id, evidence, outcome, result: "timeout", silent });
    await replyWithOutcome(interaction, { outcome, actor, target, reason, durationMs, ...(isEvidenceAttached && evidence ? { evidence } : {}) });
  },
} satisfies BotCommand;
