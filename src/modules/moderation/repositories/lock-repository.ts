import { and, eq } from "drizzle-orm";

import type { Database } from "../../../core/database/client.js";
import { moderationLockStates } from "../database/schema.js";

export class LockRepository {
  constructor(private readonly db: Database) {}

  async create(input: typeof moderationLockStates.$inferInsert): Promise<boolean> {
    const [created] = await this.db.insert(moderationLockStates).values(input)
      .onConflictDoNothing({ target: [moderationLockStates.guildId, moderationLockStates.channelId] })
      .returning({ channelId: moderationLockStates.channelId });
    return Boolean(created);
  }

  async take(guildId: string, channelId: string) {
    const [state] = await this.db.delete(moderationLockStates).where(and(eq(moderationLockStates.guildId, guildId), eq(moderationLockStates.channelId, channelId))).returning();
    return state;
  }

  async restore(input: typeof moderationLockStates.$inferInsert): Promise<void> {
    await this.db.insert(moderationLockStates).values(input).onConflictDoNothing({ target: [moderationLockStates.guildId, moderationLockStates.channelId] });
  }
}
