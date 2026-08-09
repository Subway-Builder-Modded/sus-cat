import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction, requireTargetMember } from "../interactions/context.js";
import { replyWithOutcome } from "../interactions/replies.js";
import { attachActionEvidence, requireActionEvidenceEnabled } from "../interactions/action-evidence.js";

export default {
  data: new SlashCommandBuilder().setName("warn").setDescription("Issue a formal warning")
    .addUserOption((option) => option.setName("user").setDescription("Member to warn").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason for the warning").setMaxLength(1_000).setRequired(true))
    .addBooleanOption((option) => option.setName("silent").setDescription("Skip case history and user notification"))
    .addStringOption((option) => option.setName("evidence").setDescription("Optional evidence text or link").setMaxLength(1_000)),
  requirements: { moduleId: "moderation", featureId: "warnings", nativeUserPermission: PermissionFlagsBits.ModerateMembers, guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction), target = await requireTargetMember(interaction);
    const reason = interaction.options.getString("reason", true), silent = interaction.options.getBoolean("silent") ?? false, evidence = interaction.options.getString("evidence");
    await requireActionEvidenceEnabled(client, guild.id, evidence, silent);
    const outcome = await moderation(client).moderation.warn({ guild, actor, target, reason, silent, idempotencyKey: interaction.id });
    const isEvidenceAttached = await attachActionEvidence(client, { guildId: guild.id, actorId: actor.id, interactionId: interaction.id, evidence, outcome, result: "warn", silent });
    await replyWithOutcome(interaction, { outcome, actor, target, reason, ...(isEvidenceAttached && evidence ? { evidence } : {}) });
  },
} satisfies BotCommand;
