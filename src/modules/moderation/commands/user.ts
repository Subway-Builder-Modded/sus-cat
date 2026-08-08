import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { BotClient } from "../../../core/bot/bot-client.js";
import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction } from "../interactions/context.js";
import { replyPrivately } from "../interactions/replies.js";
import type { ModerationAction } from "../domain/types.js";
import { timelineView } from "../ui/cases/case-view.js";
import { userDashboard } from "../ui/users/user-view.js";

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
    const actions = filterActions(subcommand), timeline = await moderation(client).cases.timeline(userCase.id, 1, 5, actions);
    if (!timeline) throw new Error("This user has no moderation case in this server.");
    await replyPrivately(interaction, timelineView({ ...timeline, actorId: actor.id }));
  },
} satisfies BotCommand;

export async function buildUserPayload(client: BotClient, guildId: string, userId: string, actorId: string) {
  const guild = await client.guilds.fetch(guildId);
  const [user, member, userCase, summary] = await Promise.all([client.users.fetch(userId), guild.members.fetch(userId).catch(() => undefined), moderation(client).cases.getByUser(guildId, userId), moderation(client).cases.summary(guildId, userId)]);
  const recent = userCase ? (await moderation(client).cases.timeline(userCase.id, 1, 5))?.entries ?? [] : [];
  return userDashboard({ user, ...(member ? { member } : {}), ...(userCase ? { case: userCase } : {}), summary, recent, actorId });
}

export function filterActions(view: string): ModerationAction[] | undefined {
  if (view === "warns" || view === "warn") return ["warn"];
  if (view === "timeouts" || view === "timeout") return ["timeout", "untimeout"];
  if (view === "kicks" || view === "kick") return ["kick"];
  if (view === "bans" || view === "ban") return ["ban", "unban"];
  return undefined;
}
