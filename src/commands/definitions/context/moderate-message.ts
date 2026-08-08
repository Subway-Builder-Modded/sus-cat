import { ActionRowBuilder, ApplicationCommandType, ButtonBuilder, ButtonStyle, ContextMenuCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";

import type { BotCommand } from "../../command.js";
import { moderation, requireGuildInteraction } from "../../../moderation/interactions/context.js";
import { requireCapability } from "../../../moderation/permissions/capabilities.js";
import { moderationColors } from "../../../moderation/ui/theme.js";
import { componentId } from "../../../moderation/utils/custom-id.js";
import { truncate } from "../../../moderation/utils/validation.js";

export default {
  data: new ContextMenuCommandBuilder().setName("Moderate Message").setType(ApplicationCommandType.Message).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(client, interaction) {
    if (!interaction.isMessageContextMenuCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const module = moderation(client);
    requireCapability(actor, "moderation.view", await module.configs.get(guild.id));
    const message = interaction.targetMessage;
    const summary = await module.cases.summary(guild.id, message.author.id);
    const embed = new EmbedBuilder().setColor(moderationColors.warning).setTitle("Moderate Message").setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
      .setDescription(truncate(message.content || "*No text content*", 1_000))
      .addFields(
        { name: "Author", value: `${message.author} \`${message.author.id}\``, inline: true },
        { name: "Channel", value: `${message.channel}`, inline: true },
        { name: "Sent", value: `<t:${Math.floor(message.createdTimestamp / 1_000)}:R>`, inline: true },
        { name: "Context", value: `[Jump to message](${message.url}) • ${message.attachments.size} attachment${message.attachments.size === 1 ? "" : "s"}` },
        { name: "Recent summary", value: `${summary.warnings} warnings • ${summary.timeouts} timeouts • ${summary.active} active cases` },
      );
    const parts = [actor.id, message.channel.id, message.id];
    const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(componentId("msg_delete", ...parts)).setLabel("Delete").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(componentId("msg_warn", ...parts)).setLabel("Delete + Warn").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(componentId("msg_timeout", ...parts)).setLabel("Delete + Timeout").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(componentId("msg_evidence", ...parts)).setLabel("Add as Evidence").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(componentId("history", actor.id, message.author.id, "1")).setLabel("User History").setStyle(ButtonStyle.Primary),
    );
    await interaction.reply({ embeds: [embed], components: [actions], ephemeral: true, allowedMentions: { parse: [] } });
  },
} satisfies BotCommand;
