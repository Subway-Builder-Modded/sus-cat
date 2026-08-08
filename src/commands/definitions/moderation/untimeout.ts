import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../command.js";
import { moderation, requireGuildInteraction, requireTargetMember } from "../../../moderation/interactions/context.js";
import { replyWithCase } from "../../../moderation/interactions/replies.js";

export default {
  data: new SlashCommandBuilder().setName("untimeout").setDescription("Remove a member's timeout")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName("user").setDescription("Member").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason for removing the timeout").setMaxLength(1_000).setRequired(true))
    .addIntegerOption((option) => option.setName("related-case").setDescription("Related timeout case number").setMinValue(1)),
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const target = await requireTargetMember(interaction);
    const relatedNumber = interaction.options.getInteger("related-case");
    const related = relatedNumber ? await moderation(client).cases.getByNumber(guild.id, relatedNumber) : undefined;
    const item = await moderation(client).moderation.untimeout({ guild, actor, target, idempotencyKey: interaction.id, reason: interaction.options.getString("reason", true) }, related?.id);
    if (related?.status === "active") {
      await moderation(client).cases.transition(related.id, "reversed", actor.id, { reversalCaseId: item.id });
      await moderation(client).cases.cancelScheduled(related.id);
    }
    await replyWithCase(interaction, item);
  },
} satisfies BotCommand;
