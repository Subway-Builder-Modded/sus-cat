import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction } from "../interactions/context.js";
import { replyPrivately } from "../interactions/replies.js";
import { confirmationButtons } from "../ui/confirmation.js";
import { confirmationEmbed, successEmbed } from "../ui/responses.js";

export default {
  data: new SlashCommandBuilder().setName("purge").setDescription("Delete recent messages using optional filters")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) => option.setName("count").setDescription("Maximum messages to delete").setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption((option) => option.setName("user").setDescription("Only this author"))
    .addBooleanOption((option) => option.setName("bots").setDescription("Only bot messages"))
    .addBooleanOption((option) => option.setName("links").setDescription("Only messages containing links"))
    .addBooleanOption((option) => option.setName("attachments").setDescription("Only messages with attachments"))
    .addStringOption((option) => option.setName("contains").setDescription("Only messages containing this text").setMaxLength(100)),
  requirements: { moduleId: "moderation", featureId: "purge", capability: "moderation.purge", guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) throw new Error("Purge can only be used in a server text channel.");
    const module = moderation(client);
    const count = interaction.options.getInteger("count", true);
    const userId = interaction.options.getUser("user")?.id;
    const bots = interaction.options.getBoolean("bots");
    const links = interaction.options.getBoolean("links");
    const attachments = interaction.options.getBoolean("attachments");
    const contains = interaction.options.getString("contains");
    const filters = { count, ...(userId ? { userId } : {}), ...(bots !== null ? { bots } : {}), ...(links !== null ? { links } : {}), ...(attachments !== null ? { attachments } : {}), ...(contains ? { contains } : {}) };
    const config = await module.configs.get(guild.id);
    if (count >= config.purgeConfirmationThreshold) {
      const token = module.confirmations.create({ type: "purge", guildId: guild.id, actorId: actor.id, channelId: interaction.channel.id, ...filters, idempotencyKey: interaction.id });
      await replyPrivately(interaction, { embeds: [confirmationEmbed("Confirm Purge", `Up to **${count}** matching messages will be permanently deleted from ${interaction.channel}. Messages older than 14 days cannot be bulk deleted and will be reported.`)], components: [confirmationButtons(token)] });
      return;
    }
    const result = await module.channels.purge(interaction.channel, actor, filters);
    await replyPrivately(interaction, { embeds: [successEmbed("Purge complete", `Deleted **${result.deleted}** of ${result.matched} matching messages.${result.tooOld ? ` ${result.tooOld} were older than Discord's 14-day bulk-delete limit.` : ""}`)] });
  },
} satisfies BotCommand;
