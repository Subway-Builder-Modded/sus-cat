import type { BotClient } from "../../../core/bot/bot-client.js";
import { caseOverview } from "../ui/cases/case-view.js";
import { requireModerationModule } from "../moderation-module.js";

export async function buildCasePayload(client: BotClient, guildId: string, caseNumber: number, actorId: string) {
  const module = requireModerationModule(client);
  const item = await module.cases.getByNumber(guildId, caseNumber);
  if (!item) throw new Error("That moderation case does not exist.");
  const [user, summary, timeline, adjacent, isEvidenceEnabled] = await Promise.all([
    client.users.fetch(item.targetUserId).catch(() => undefined),
    module.cases.summary(guildId, item.targetUserId),
    module.cases.timeline(guildId, item.id, 1, 1),
    module.cases.adjacent(guildId, caseNumber),
    client.platform.settings.isFeatureEnabled(guildId, "moderation", "evidence"),
  ]);
  return caseOverview({
    case: item,
    ...(user ? { user } : {}),
    summary,
    ...(timeline?.entries[0] ? { latest: timeline.entries[0] } : {}),
    actorId,
    isEvidenceEnabled,
    ...(adjacent.previous ? { previousNumber: adjacent.previous.caseNumber } : {}),
    ...(adjacent.next ? { nextNumber: adjacent.next.caseNumber } : {}),
  });
}
