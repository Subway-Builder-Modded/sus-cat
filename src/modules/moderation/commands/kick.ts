import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction, requireTargetMember } from "../interactions/context.js";
import { replyWithOutcome } from "../interactions/replies.js";
import { attachActionEvidence } from "./action-evidence.js";

export default {
  data: new SlashCommandBuilder().setName("kick").setDescription("Remove a member from the server")
    .addUserOption((option) => option.setName("user").setDescription("Member to kick").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason").setMaxLength(1_000).setRequired(true))
    .addBooleanOption((option) => option.setName("silent").setDescription("Skip case history and user notification"))
    .addStringOption((option) => option.setName("evidence").setDescription("Optional evidence text or link").setMaxLength(1_000)),
  requirements: { moduleId: "moderation", featureId: "kicks", nativeUserPermission: PermissionFlagsBits.KickMembers, guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction), target = await requireTargetMember(interaction);
    const reason = interaction.options.getString("reason", true), silent = interaction.options.getBoolean("silent") ?? false, evidence = interaction.options.getString("evidence");
    const outcome = await moderation(client).moderation.kick({ guild, actor, target, reason, silent, idempotencyKey: interaction.id });
    await attachActionEvidence(client, { guildId: guild.id, actorId: actor.id, interactionId: interaction.id, evidence, outcome, result: "kick", silent });
    await replyWithOutcome(interaction, { outcome, actor, target, reason, ...(evidence && !silent ? { evidence } : {}) });
  },
} satisfies BotCommand;
