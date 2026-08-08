import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction } from "../interactions/context.js";
import { replyWithOutcome } from "../interactions/replies.js";
import { parseSnowflake } from "../utils/validation.js";

export default {
  data: new SlashCommandBuilder().setName("unban").setDescription("Unban a user by ID")
    .addStringOption((option) => option.setName("user-id").setDescription("Discord user ID").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason").setMaxLength(1_000).setRequired(true)),
  requirements: { moduleId: "moderation", featureId: "bans", nativeUserPermission: PermissionFlagsBits.BanMembers, guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction), reason = interaction.options.getString("reason", true);
    const user = await client.users.fetch(parseSnowflake(interaction.options.getString("user-id", true)));
    const outcome = await moderation(client).moderation.unban({ guild, actor, target: user, reason, idempotencyKey: interaction.id });
    await replyWithOutcome(interaction, { outcome, actor, target: user, reason });
  },
} satisfies BotCommand;
