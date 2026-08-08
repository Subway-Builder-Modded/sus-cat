import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction } from "../interactions/context.js";
import { replyPrivately } from "../interactions/replies.js";
import { successEmbed } from "../ui/responses.js";

export default {
  data: new SlashCommandBuilder().setName("sudo").setDescription("Send a message through the bot")
    .addStringOption((option) => option.setName("message").setDescription("Message to send").setRequired(true).setMaxLength(2_000))
    .addChannelOption((option) => option.setName("channel").setDescription("Channel; defaults to current").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread)),
  requirements: { moduleId: "moderation", featureId: "sudo", nativeUserPermission: PermissionFlagsBits.ManageGuild, guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const channelId = interaction.options.getChannel("channel")?.id ?? interaction.channelId;
    const channel = await guild.channels.fetch(channelId);
    if (!channel?.isTextBased() || !channel.isSendable()) throw new Error("Select a text channel or thread where I can send messages.");
    const me = guild.members.me ?? await guild.members.fetchMe();
    const sendPermission = channel.isThread() ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages;
    if (!channel.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, sendPermission])) throw new Error(`I need View Channel and ${channel.isThread() ? "Send Messages in Threads" : "Send Messages"} in the selected channel.`);
    await moderation(client).channels.sendAsBot(channel, actor, interaction.options.getString("message", true), interaction.id);
    await replyPrivately(interaction, { embeds: [successEmbed("Message sent", `The message was sent in ${channel}.`)] });
  },
} satisfies BotCommand;
