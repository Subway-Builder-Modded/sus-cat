import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction } from "../interactions/context.js";
import { replyWithCase } from "../interactions/replies.js";
import { parseSnowflake } from "../utils/validation.js";

export default {
  data: new SlashCommandBuilder().setName("unban").setDescription("Unban a user by ID")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((option) => option.setName("user-id").setDescription("Discord user ID").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason").setMaxLength(1_000).setRequired(true))
    .addIntegerOption((option) => option.setName("related-case").setDescription("Related ban case number").setMinValue(1)),
  requirements: { moduleId: "moderation", featureId: "bans", capability: "moderation.unban", guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const user = await client.users.fetch(parseSnowflake(interaction.options.getString("user-id", true)));
    const relatedNumber = interaction.options.getInteger("related-case");
    const related = relatedNumber ? await moderation(client).cases.getByNumber(guild.id, relatedNumber) : undefined;
    const item = await moderation(client).moderation.unban({ guild, actor, target: user, idempotencyKey: interaction.id, reason: interaction.options.getString("reason", true), ...(related ? { relatedCaseId: related.id } : {}) });
    if (related?.status === "active") {
      await moderation(client).cases.transition(related.id, "reversed", actor.id, { reversalCaseId: item.id });
      await moderation(client).cases.cancelScheduled(related.id);
    }
    await replyWithCase(interaction, item);
  },
} satisfies BotCommand;
