import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../command.js";
import { moderation, requireGuildInteraction } from "../../../moderation/interactions/context.js";
import { requireCapability } from "../../../moderation/permissions/capabilities.js";
import { buildHistoryDashboard } from "../../../moderation/ui/history-dashboard.js";

export default {
  data: new SlashCommandBuilder().setName("history").setDescription("Open a member's private moderation history")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption((option) => option.setName("user").setDescription("Member or user").setRequired(true)),
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const module = moderation(client);
    requireCapability(actor, "moderation.view", await module.configs.get(guild.id));
    const user = interaction.options.getUser("user", true);
    const [summary, history, member] = await Promise.all([module.cases.summary(guild.id, user.id), module.cases.history(guild.id, user.id), guild.members.fetch(user.id).catch(() => undefined)]);
    await interaction.reply({ ...buildHistoryDashboard(user, member, summary, history, actor.id), ephemeral: true });
  },
} satisfies BotCommand;
