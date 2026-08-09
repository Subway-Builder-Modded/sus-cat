import { eq } from "drizzle-orm";

import type { DatabaseTransaction } from "../../../core/database/client.js";
import {
  guildCaseCounters,
  moderationCustomCaseTypeAliases,
  moderationCustomCaseTypes,
  moderationLockStates,
  moderationUserCases,
} from "../database/schema.js";
import { resetActionReceipts } from "./action-receipt-repository.js";
import { resetAuditEvents } from "./audit-repository.js";

export async function resetModerationCases(transaction: DatabaseTransaction, guildId: string): Promise<void> {
  await resetAuditEvents(transaction, guildId);
  await transaction.delete(moderationCustomCaseTypeAliases).where(eq(moderationCustomCaseTypeAliases.guildId, guildId));
  await transaction.delete(moderationCustomCaseTypes).where(eq(moderationCustomCaseTypes.guildId, guildId));
  await transaction.delete(moderationUserCases).where(eq(moderationUserCases.guildId, guildId));
  await transaction.delete(guildCaseCounters).where(eq(guildCaseCounters.guildId, guildId));
}

export async function resetModerationGuild(transaction: DatabaseTransaction, guildId: string): Promise<void> {
  await resetModerationCases(transaction, guildId);
  await resetActionReceipts(transaction, guildId);
  await transaction.delete(moderationLockStates).where(eq(moderationLockStates.guildId, guildId));
}
