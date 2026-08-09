import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction } from "../interactions/context.js";
import { replyPrivately } from "../interactions/replies.js";
import { timelineView } from "../ui/cases/case-view.js";
import { buildUserPayload, filterCaseActions } from "../interactions/user-view-controller.js";

const subcommands = ["view", "case", "warns", "timeouts", "kicks", "bans"] as const;
const builder = new SlashCommandBuilder().setName("user").setDescription("Open a user dashboard or filtered moderation view");
for (const name of subcommands) builder.addSubcommand((command) => command.setName(name).setDescription(name === "view" ? "Open the interactive user dashboard" : `View the user's ${name === "case" ? "complete case" : name}`).addUserOption((option) => option.setName("user").setDescription("User").setRequired(true)));

export default {
  data: builder,
  requirements: { moduleId: "moderation", featureId: "user-management", nativeUserPermission: PermissionFlagsBits.ViewAuditLog, guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction), user = interaction.options.getUser("user", true), subcommand = interaction.options.getSubcommand();
    if (subcommand === "view") { await replyPrivately(interaction, await buildUserPayload(client, guild.id, user.id, actor.id)); return; }
    const userCase = await moderation(client).cases.getByUser(guild.id, user.id);
    if (!userCase) throw new Error("This user has no moderation case in this server.");
    const actions = filterCaseActions(subcommand), timeline = await moderation(client).cases.timeline(guild.id, userCase.id, 1, 5, actions);
    if (!timeline) throw new Error("This user has no moderation case in this server.");
    await replyPrivately(interaction, timelineView({ ...timeline, actorId: actor.id }));
  },
} satisfies BotCommand;
