import { eq } from "drizzle-orm";

import type { Database, DatabaseTransaction } from "../../../core/database/client.js";
import { moderationAuditEvents } from "../database/schema.js";

export interface AuditEventInput {
  readonly eventType: string;
  readonly guildId: string;
  readonly actorId: string;
  readonly caseId?: string;
  readonly targetUserId?: string;
  readonly metadata?: Record<string, unknown>;
  readonly caseEntryId?: string;
  readonly before?: Record<string, unknown>;
  readonly after?: Record<string, unknown>;
  readonly sourceEventId?: string;
}

export class AuditRepository {
  constructor(private readonly db: Database) {}

  async record(input: AuditEventInput): Promise<void> {
    await this.db.insert(moderationAuditEvents).values({
      eventType: input.eventType,
      guildId: input.guildId,
      actorId: input.actorId,
      metadata: input.metadata ?? {},
      ...(input.caseId ? { caseId: input.caseId } : {}),
      ...(input.targetUserId ? { targetUserId: input.targetUserId } : {}),
      ...(input.caseEntryId ? { caseEntryId: input.caseEntryId } : {}),
      ...(input.before ? { before: input.before } : {}),
      ...(input.after ? { after: input.after } : {}),
      ...(input.sourceEventId ? { sourceEventId: input.sourceEventId } : {}),
    }).onConflictDoNothing();
  }

  async recordNative(input: AuditEventInput & { readonly sourceEventId: string }): Promise<boolean> {
    const [created] = await this.db.insert(moderationAuditEvents).values({ ...input, metadata: input.metadata ?? {} })
      .onConflictDoNothing({ target: [moderationAuditEvents.guildId, moderationAuditEvents.sourceEventId] })
      .returning({ id: moderationAuditEvents.id });
    return Boolean(created);
  }
}

export async function resetAuditEvents(transaction: DatabaseTransaction, guildId: string): Promise<void> {
  await transaction.delete(moderationAuditEvents).where(eq(moderationAuditEvents.guildId, guildId));
}
