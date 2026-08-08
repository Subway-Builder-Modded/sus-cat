import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction } from "../interactions/context.js";
import { replyPrivately } from "../interactions/replies.js";
import { successEmbed } from "../ui/responses.js";

export default {
  data: new SlashCommandBuilder().setName("lock").setDescription("Safely lock a text channel")
    .addStringOption((option) => option.setName("reason").setDescription("Optional audit reason").setMaxLength(1_000))
    .addChannelOption((option) => option.setName("channel").setDescription("Channel; defaults to current").addChannelTypes(ChannelType.GuildText)),
  requirements: { moduleId: "moderation", featureId: "channel-locks", nativeUserPermission: PermissionFlagsBits.ManageChannels, guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const selected = interaction.options.getChannel("channel");
    const channel = selected ? await guild.channels.fetch(selected.id) : interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) throw new Error("Select a text channel.");
    await moderation(client).channels.lock(channel, actor, interaction.options.getString("reason") ?? undefined);
    await replyPrivately(interaction, { embeds: [successEmbed("Channel locked", `${channel} was locked without replacing its existing permission overwrite.`)] });
  },
} satisfies BotCommand;
