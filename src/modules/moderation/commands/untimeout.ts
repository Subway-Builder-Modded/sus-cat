import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction, requireTargetMember } from "../interactions/context.js";
import { replyWithOutcome } from "../interactions/replies.js";

export default {
  data: new SlashCommandBuilder().setName("untimeout").setDescription("Remove a member's timeout")
    .addUserOption((option) => option.setName("user").setDescription("Member").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason for removing the timeout").setMaxLength(1_000).setRequired(true)),
  requirements: { moduleId: "moderation", featureId: "timeouts", nativeUserPermission: PermissionFlagsBits.ModerateMembers, guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction), target = await requireTargetMember(interaction), reason = interaction.options.getString("reason", true);
    const outcome = await moderation(client).moderation.untimeout({ guild, actor, target, reason, idempotencyKey: interaction.id });
    await replyWithOutcome(interaction, { outcome, actor, target, reason });
  },
} satisfies BotCommand;
