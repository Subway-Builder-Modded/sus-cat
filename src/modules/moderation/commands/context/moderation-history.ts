import { ApplicationCommandType, ContextMenuCommandBuilder, PermissionFlagsBits } from "discord.js";

import type { BotCommand } from "../../../../core/commands/command.js";
import { moderation, requireGuildInteraction } from "../../interactions/context.js";
import { requireCapability } from "../../permissions/capabilities.js";
import { buildHistoryDashboard } from "../../ui/history-dashboard.js";
import { replyPrivately } from "../../interactions/replies.js";

export default {
  data: new ContextMenuCommandBuilder().setName("Moderation History").setType(ApplicationCommandType.User).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  requirements: { moduleId: "moderation", featureId: "case-management", capability: "moderation.view", guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isUserContextMenuCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const module = moderation(client);
    requireCapability(actor, "moderation.view", await module.configs.get(guild.id));
    const [summary, history, member] = await Promise.all([module.cases.summary(guild.id, interaction.targetUser.id), module.cases.history(guild.id, interaction.targetUser.id), guild.members.fetch(interaction.targetUser.id).catch(() => undefined)]);
    await replyPrivately(interaction, buildHistoryDashboard(interaction.targetUser, member, summary, history, actor.id));
  },
} satisfies BotCommand;
