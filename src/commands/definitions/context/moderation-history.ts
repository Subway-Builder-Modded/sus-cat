import { ApplicationCommandType, ContextMenuCommandBuilder, PermissionFlagsBits } from "discord.js";

import type { BotCommand } from "../../command.js";
import { moderation, requireGuildInteraction } from "../../../moderation/interactions/context.js";
import { requireCapability } from "../../../moderation/permissions/capabilities.js";
import { buildHistoryDashboard } from "../../../moderation/ui/history-dashboard.js";

export default {
  data: new ContextMenuCommandBuilder().setName("Moderation History").setType(ApplicationCommandType.User).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(client, interaction) {
    if (!interaction.isUserContextMenuCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const module = moderation(client);
    requireCapability(actor, "moderation.view", await module.configs.get(guild.id));
    const [summary, history, member] = await Promise.all([module.cases.summary(guild.id, interaction.targetUser.id), module.cases.history(guild.id, interaction.targetUser.id), guild.members.fetch(interaction.targetUser.id).catch(() => undefined)]);
    await interaction.reply({ ...buildHistoryDashboard(interaction.targetUser, member, summary, history, actor.id), ephemeral: true });
  },
} satisfies BotCommand;
