import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../command.js";
import { moderation, requireGuildInteraction, requireTargetMember } from "../../../moderation/interactions/context.js";
import { replyPrivately } from "../../../moderation/interactions/replies.js";
import { confirmationButtons } from "../../../moderation/ui/confirmation.js";
import { confirmationEmbed } from "../../../moderation/ui/responses.js";

export default {
  data: new SlashCommandBuilder().setName("softban").setDescription("Ban and immediately unban a member to remove recent messages")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) => option.setName("user").setDescription("Member").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason").setMaxLength(1_000).setRequired(true))
    .addIntegerOption((option) => option.setName("delete-hours").setDescription("Hours of messages to delete").setMinValue(0).setMaxValue(168)),
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const target = await requireTargetMember(interaction);
    const reason = interaction.options.getString("reason", true);
    const deleteSeconds = (interaction.options.getInteger("delete-hours") ?? 24) * 3_600;
    const token = moderation(client).confirmations.create({ type: "softban", guildId: guild.id, actorId: actor.id, targetId: target.id, reason, deleteSeconds, idempotencyKey: interaction.id });
    await replyPrivately(interaction, { embeds: [confirmationEmbed("Confirm Softban", `${target} will be banned, up to ${deleteSeconds / 3_600} hours of messages will be removed, and they will immediately be unbanned.\n\n**Reason**\n${reason}`)], components: [confirmationButtons(token)] });
  },
} satisfies BotCommand;
