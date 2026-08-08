import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction } from "../interactions/context.js";
import { requireCapability } from "../permissions/capabilities.js";
import { buildHistoryDashboard } from "../ui/history-dashboard.js";
import { replyPrivately } from "../interactions/replies.js";

export default {
  data: new SlashCommandBuilder().setName("history").setDescription("Open a member's private moderation history")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption((option) => option.setName("user").setDescription("Member or user").setRequired(true)),
  requirements: { moduleId: "moderation", featureId: "case-management", capability: "moderation.view", guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const module = moderation(client);
    requireCapability(actor, "moderation.view", await module.configs.get(guild.id));
    const user = interaction.options.getUser("user", true);
    const [summary, history, member] = await Promise.all([module.cases.summary(guild.id, user.id), module.cases.history(guild.id, user.id), guild.members.fetch(user.id).catch(() => undefined)]);
    await replyPrivately(interaction, buildHistoryDashboard(user, member, summary, history, actor.id));
  },
} satisfies BotCommand;
