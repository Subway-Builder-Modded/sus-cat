import { ActionRowBuilder, ApplicationCommandType, ButtonBuilder, ButtonStyle, ContextMenuCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";

import type { BotCommand } from "../../../../core/commands/command.js";
import { moderation, requireGuildInteraction } from "../../interactions/context.js";
import { requireCapability } from "../../permissions/capabilities.js";
import { componentId } from "../../utils/custom-id.js";
import { moderationColors } from "../../ui/theme.js";
import { replyPrivately } from "../../interactions/replies.js";

export default {
  data: new ContextMenuCommandBuilder().setName("Quick Moderate").setType(ApplicationCommandType.User).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  requirements: { moduleId: "moderation", featureId: "case-management", capability: "moderation.view", guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isUserContextMenuCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const module = moderation(client);
    requireCapability(actor, "moderation.view", await module.configs.get(guild.id));
    const target = await guild.members.fetch(interaction.targetUser.id).catch(() => undefined);
    const summary = await module.cases.summary(guild.id, interaction.targetUser.id);
    const embed = new EmbedBuilder().setColor(moderationColors.info).setTitle(`Moderate ${interaction.targetUser.username}`).setThumbnail(interaction.targetUser.displayAvatarURL()).setDescription(`${interaction.targetUser} \`${interaction.targetUser.id}\``).addFields(
      { name: "Account", value: `Created <t:${Math.floor(interaction.targetUser.createdTimestamp / 1_000)}:R>\nJoined ${target?.joinedTimestamp ? `<t:${Math.floor(target.joinedTimestamp / 1_000)}:R>` : "Not in server"}` },
      { name: "Current", value: `${target?.isCommunicationDisabled() ? "Timed out" : "Not timed out"} • ${summary.active} active cases` },
      { name: "History", value: `${summary.warnings} warnings • ${summary.timeouts} timeouts • ${summary.kicks} kicks • ${summary.bans} bans • ${summary.notes} notes` },
    );
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(componentId("quick_warn", actor.id, interaction.targetUser.id)).setLabel("Warn").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(componentId("quick_timeout", actor.id, interaction.targetUser.id)).setLabel("Timeout").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(componentId("quick_kick", actor.id, interaction.targetUser.id)).setLabel("Kick").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(componentId("quick_ban", actor.id, interaction.targetUser.id)).setLabel("Ban").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(componentId("quick_note", actor.id, interaction.targetUser.id)).setLabel("Add Note").setStyle(ButtonStyle.Secondary),
    );
    const navigation = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("history", actor.id, interaction.targetUser.id, "1")).setLabel("History").setStyle(ButtonStyle.Secondary));
    await replyPrivately(interaction, { embeds: [embed], components: [row, navigation], allowedMentions: { parse: [] } });
  },
} satisfies BotCommand;
