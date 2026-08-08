import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction } from "../interactions/context.js";
import { replyPrivately } from "../interactions/replies.js";
import { buildActionCard } from "../ui/actions/action-card.js";

export default {
  data: new SlashCommandBuilder().setName("slowmode").setDescription("Set or remove channel slowmode")
    .addIntegerOption((option) => option.setName("seconds").setDescription("0 disables slowmode").setRequired(true).setMinValue(0).setMaxValue(21_600))
    .addChannelOption((option) => option.setName("channel").setDescription("Channel; defaults to current").addChannelTypes(ChannelType.GuildText)),
  requirements: { moduleId: "moderation", featureId: "slowmode", nativeUserPermission: PermissionFlagsBits.ManageChannels, guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction), selected = interaction.options.getChannel("channel");
    const channel = selected ? await guild.channels.fetch(selected.id) : interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) throw new Error("Select a text channel.");
    const result = await moderation(client).channels.setSlowmode(channel, actor, interaction.options.getInteger("seconds", true));
    await replyPrivately(interaction, { embeds: [buildActionCard({ action: "slowmode", actor, result: `${channel}`, details: [{ name: "Before", value: `${result.before} seconds`, inline: true }, { name: "After", value: `${result.after} seconds`, inline: true }] })] });
  },
} satisfies BotCommand;
