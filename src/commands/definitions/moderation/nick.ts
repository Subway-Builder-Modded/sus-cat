import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../command.js";
import { moderation, requireGuildInteraction, requireTargetMember } from "../../../moderation/interactions/context.js";
import { replyWithCase } from "../../../moderation/interactions/replies.js";

export default {
  data: new SlashCommandBuilder().setName("nick").setDescription("Set or reset a member nickname")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .addUserOption((option) => option.setName("user").setDescription("Member").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason").setMaxLength(1_000).setRequired(true))
    .addStringOption((option) => option.setName("nickname").setDescription("New nickname; omit to reset").setMaxLength(32)),
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const target = await requireTargetMember(interaction);
    const item = await moderation(client).moderation.nick({ guild, actor, target, idempotencyKey: interaction.id, reason: interaction.options.getString("reason", true) }, interaction.options.getString("nickname"));
    await replyWithCase(interaction, item);
  },
} satisfies BotCommand;
