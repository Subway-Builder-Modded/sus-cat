import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction, requireTargetMember } from "../interactions/context.js";
import { replyPrivately } from "../interactions/replies.js";
import { buildActionCard } from "../ui/actions/action-card.js";

export default {
  data: new SlashCommandBuilder().setName("nickname").setDescription("Set or reset a member nickname")
    .addUserOption((option) => option.setName("user").setDescription("Member").setRequired(true))
    .addStringOption((option) => option.setName("nickname").setDescription("New nickname; omit to reset").setMaxLength(32)),
  requirements: { moduleId: "moderation", featureId: "nickname", nativeUserPermission: PermissionFlagsBits.ManageNicknames, guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction), target = await requireTargetMember(interaction), nickname = interaction.options.getString("nickname");
    const before = target.nickname ?? target.displayName;
    await moderation(client).moderation.nickname({ guild, actor, target, idempotencyKey: interaction.id }, nickname);
    await replyPrivately(interaction, { embeds: [buildActionCard({ action: "nickname", actor, target, details: [{ name: "Before", value: before, inline: true }, { name: "After", value: nickname ?? "Server default", inline: true }] })] });
  },
} satisfies BotCommand;
