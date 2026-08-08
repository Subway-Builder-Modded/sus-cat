import { eq } from "drizzle-orm";

import type { Database } from "../../../core/database/client.js";
import { moderationLockStates } from "../database/schema.js";

export class LockRepository {
  constructor(private readonly db: Database) {}

  get(channelId: string) {
    return this.db.query.moderationLockStates.findFirst({ where: eq(moderationLockStates.channelId, channelId) });
  }

  async save(input: typeof moderationLockStates.$inferInsert): Promise<void> {
    await this.db.insert(moderationLockStates).values(input);
  }

  async remove(channelId: string): Promise<void> {
    await this.db.delete(moderationLockStates).where(eq(moderationLockStates.channelId, channelId));
  }
}
