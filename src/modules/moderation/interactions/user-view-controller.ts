import type { BotClient } from "../../../core/bot/bot-client.js";
import type { ModerationAction } from "../domain/types.js";
import { requireModerationModule } from "../moderation-module.js";
import { userDashboard } from "../ui/users/user-view.js";

export async function buildUserPayload(client: BotClient, guildId: string, userId: string, actorId: string) {
  const module = requireModerationModule(client);
  const guild = await client.guilds.fetch(guildId);
  const [user, member, userCase, summary] = await Promise.all([
    client.users.fetch(userId),
    guild.members.fetch(userId).catch(() => undefined),
    module.cases.getByUser(guildId, userId),
    module.cases.summary(guildId, userId),
  ]);
  const recent = userCase ? (await module.cases.timeline(guildId, userCase.id, 1, 5))?.entries ?? [] : [];
  return userDashboard({ user, ...(member ? { member } : {}), ...(userCase ? { case: userCase } : {}), summary, recent, actorId });
}

export function filterCaseActions(view: string): ModerationAction[] | undefined {
  if (view === "warns" || view === "warn") return ["warn"];
  if (view === "timeouts" || view === "timeout") return ["timeout", "untimeout"];
  if (view === "kicks" || view === "kick") return ["kick"];
  if (view === "bans" || view === "ban") return ["ban", "unban"];
  return undefined;
}
