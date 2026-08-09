import { ChannelType, PermissionFlagsBits, SlashCommandBuilder, type TextChannel } from "discord.js";
import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction } from "../interactions/context.js";
import { replyPrivately } from "../interactions/replies.js";
import { confirmationButtons } from "../ui/confirmation.js";
import { confirmationEmbed, successEmbed } from "../ui/responses.js";
import { purgeSummary } from "../ui/purge-summary.js";

export default {
  data: new SlashCommandBuilder().setName("purge").setDescription("Preview and delete matching messages")
    .addIntegerOption((option) => option.setName("count").setDescription("Maximum matching messages").setRequired(true).setMinValue(1).setMaxValue(1000))
    .addStringOption((option) => option.setName("scope").setDescription("Where to scan").addChoices({ name: "Current channel", value: "current" }, { name: "Selected channel", value: "selected" }, { name: "All accessible text channels", value: "all" }))
    .addChannelOption((option) => option.setName("channel").setDescription("Channel used with Selected scope").addChannelTypes(ChannelType.GuildText))
    .addUserOption((option) => option.setName("user").setDescription("Only this author"))
    .addBooleanOption((option) => option.setName("bots").setDescription("Only bot messages"))
    .addBooleanOption((option) => option.setName("links").setDescription("Only messages containing links"))
    .addBooleanOption((option) => option.setName("attachments").setDescription("Only messages with attachments"))
    .addStringOption((option) => option.setName("contains").setDescription("Only messages containing this text").setMaxLength(100)),
  requirements: { moduleId: "moderation", featureId: "purge", nativeUserPermission: PermissionFlagsBits.ManageMessages, guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction), module = moderation(client);
    const channels = await resolveChannels(interaction.options.getString("scope") ?? "current", interaction.options.getChannel("channel")?.id, interaction.channelId, guild);
    const selectedUser = interaction.options.getUser("user");
    const contains = interaction.options.getString("contains");
    const filters = { count: interaction.options.getInteger("count", true), ...(selectedUser ? { userId: selectedUser.id } : {}), ...(interaction.options.getBoolean("bots") === true ? { bots: true } : {}), ...(interaction.options.getBoolean("links") === true ? { links: true } : {}), ...(interaction.options.getBoolean("attachments") === true ? { attachments: true } : {}), ...(contains ? { contains } : {}) };
    const preview = await module.purges.preview(channels, filters), config = await module.configs.get(guild.id);
    if (preview.matched === 0) { await replyPrivately(interaction, { embeds: [successEmbed("Nothing to purge", `Scanned **${preview.scanned}** messages and found no matches.`)] }); return; }
    if (preview.matched >= config.purgeConfirmationThreshold || channels.length > 1) {
      const token = module.confirmations.create({ type: "purge", guildId: guild.id, actorId: actor.id, channelIds: channels.map((channel) => channel.id), ...filters, idempotencyKey: interaction.id });
      await replyPrivately(interaction, { embeds: [confirmationEmbed("Confirm Purge", `Found **${preview.matched}** matching messages across **${preview.channels}** channel${preview.channels === 1 ? "" : "s"}.\n\nScanned ${preview.scanned} messages. ${preview.tooOld ? `${preview.tooOld} matches are too old for Discord bulk deletion.` : "All matches are within the bulk-delete window."}`)], components: [confirmationButtons(token, `Delete ${preview.matched} Messages`)] });
      return;
    }
    const result = await module.purges.execute(channels, actor, filters, interaction.id);
    await replyPrivately(interaction, { embeds: [successEmbed("Purge complete", purgeSummary(result))] });
  },
} satisfies BotCommand;

async function resolveChannels(scope: string, selectedId: string | undefined, currentId: string, guild: import("discord.js").Guild): Promise<TextChannel[]> {
  let ids: string[];
  if (scope === "all") {
    ids = [...guild.channels.cache.values()]
      .filter((channel): channel is TextChannel => channel.type === ChannelType.GuildText && channel.viewable)
      .map((channel) => channel.id);
  } else if (scope === "selected") {
    if (!selectedId) throw new Error("Choose a channel when using Selected scope.");
    ids = [selectedId];
  } else {
    ids = [currentId];
  }
  const channels = await Promise.all(ids.slice(0, 50).map((id) => guild.channels.fetch(id)));
  return channels.filter((channel): channel is TextChannel => channel?.type === ChannelType.GuildText && channel.viewable);
}
