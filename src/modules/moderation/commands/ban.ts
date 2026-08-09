import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction, requireTargetMember } from "../interactions/context.js";
import { replyPrivately } from "../interactions/replies.js";
import { confirmationButtons } from "../ui/confirmation.js";
import { confirmationEmbed } from "../ui/responses.js";
import { requireActionEvidenceEnabled } from "../interactions/action-evidence.js";

export default {
  data: new SlashCommandBuilder().setName("ban").setDescription("Ban a member after explicit confirmation")
    .addUserOption((option) => option.setName("user").setDescription("Member to ban").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason").setMaxLength(1_000).setRequired(true))
    .addBooleanOption((option) => option.setName("silent").setDescription("Skip case history and user notification"))
    .addIntegerOption((option) => option.setName("delete-seconds").setDescription("Seconds of recent messages to delete").setMinValue(0).setMaxValue(604_800))
    .addStringOption((option) => option.setName("evidence").setDescription("Optional evidence text or link").setMaxLength(1_000)),
  requirements: { moduleId: "moderation", featureId: "bans", nativeUserPermission: PermissionFlagsBits.BanMembers, guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction), target = await requireTargetMember(interaction);
    const reason = interaction.options.getString("reason", true), silent = interaction.options.getBoolean("silent") ?? false;
    const evidence = interaction.options.getString("evidence");
    await requireActionEvidenceEnabled(client, guild.id, evidence, silent);
    const token = moderation(client).confirmations.create({ type: "ban", guildId: guild.id, actorId: actor.id, targetId: target.id, reason, deleteSeconds: interaction.options.getInteger("delete-seconds") ?? 0, silent, ...(evidence ? { evidence } : {}), idempotencyKey: interaction.id });
    await replyPrivately(interaction, { embeds: [confirmationEmbed("Confirm Ban", `${target} \`${target.id}\`\n\n**Reason**\n${reason}\n\n**History and notification**\n${silent ? "Silent - no case entry or DM; private audit remains enabled." : "Case entry and DM follow this server's feature settings."}`)], components: [confirmationButtons(token)] });
  },
} satisfies BotCommand;
