import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../command.js";
import { moderation, requireGuildInteraction } from "../../../moderation/interactions/context.js";
import { replyPrivately } from "../../../moderation/interactions/replies.js";
import { successEmbed } from "../../../moderation/ui/responses.js";

export default {
  data: new SlashCommandBuilder().setName("unlock").setDescription("Restore a bot-managed channel lock")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((option) => option.setName("channel").setDescription("Channel; defaults to current").addChannelTypes(ChannelType.GuildText))
    .addStringOption((option) => option.setName("reason").setDescription("Reason").setRequired(true).setMaxLength(1_000)),
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const selected = interaction.options.getChannel("channel");
    const channel = selected ? await guild.channels.fetch(selected.id) : interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) throw new Error("Select a text channel.");
    await moderation(client).channels.unlock(channel, actor, interaction.options.getString("reason", true));
    await replyPrivately(interaction, { embeds: [successEmbed("Channel unlocked", `${channel}'s previous Send Messages overwrite was restored.`)] });
  },
} satisfies BotCommand;
