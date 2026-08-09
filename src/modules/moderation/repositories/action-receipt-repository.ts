import { eq } from "drizzle-orm";

import type { Database, DatabaseTransaction } from "../../../core/database/client.js";
import { moderationActionReceipts } from "../database/schema.js";

export class ActionReceiptRepository {
  constructor(private readonly db: Database) {}

  async reserve(input: { guildId: string; actorId: string; targetUserId?: string; idempotencyKey: string; action: string }): Promise<boolean> {
    const [created] = await this.db
      .insert(moderationActionReceipts)
      .values(input)
      .onConflictDoNothing({ target: [moderationActionReceipts.guildId, moderationActionReceipts.idempotencyKey] })
      .returning({ id: moderationActionReceipts.id });
    return Boolean(created);
  }
}

export async function resetActionReceipts(transaction: DatabaseTransaction, guildId: string): Promise<void> {
  await transaction.delete(moderationActionReceipts).where(eq(moderationActionReceipts.guildId, guildId));
}
