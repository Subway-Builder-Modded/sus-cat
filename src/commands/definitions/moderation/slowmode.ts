import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../command.js";
import { moderation, requireGuildInteraction } from "../../../moderation/interactions/context.js";
import { replyPrivately } from "../../../moderation/interactions/replies.js";
import { successEmbed } from "../../../moderation/ui/responses.js";

export default {
  data: new SlashCommandBuilder().setName("slowmode").setDescription("Set or remove channel slowmode")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption((option) => option.setName("seconds").setDescription("0 disables slowmode").setRequired(true).setMinValue(0).setMaxValue(21_600))
    .addStringOption((option) => option.setName("reason").setDescription("Reason").setRequired(true).setMaxLength(1_000))
    .addChannelOption((option) => option.setName("channel").setDescription("Channel; defaults to current").addChannelTypes(ChannelType.GuildText)),
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const selected = interaction.options.getChannel("channel");
    const channel = selected ? await guild.channels.fetch(selected.id) : interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) throw new Error("Select a text channel.");
    const seconds = interaction.options.getInteger("seconds", true);
    await moderation(client).channels.setSlowmode(channel, actor, seconds, interaction.options.getString("reason", true));
    await replyPrivately(interaction, { embeds: [successEmbed("Slowmode updated", `${channel} now has a ${seconds}-second slowmode.`)] });
  },
} satisfies BotCommand;
