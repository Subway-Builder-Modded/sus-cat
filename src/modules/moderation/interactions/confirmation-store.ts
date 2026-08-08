import { randomUUID } from "node:crypto";

export type ConfirmationPayload =
  | { type: "ban"; guildId: string; actorId: string; targetId: string; reason: string; deleteSeconds: number; silent: boolean; evidence?: string; idempotencyKey: string }
  | { type: "purge"; guildId: string; actorId: string; channelIds: string[]; count: number; userId?: string; bots?: boolean; links?: boolean; attachments?: boolean; contains?: string; idempotencyKey: string };

interface PendingConfirmation {
  payload: ConfirmationPayload;
  expiresAt: number;
  consumed: boolean;
}

export class ConfirmationStore {
  private readonly entries = new Map<string, PendingConfirmation>();

  create(payload: ConfirmationPayload): string {
    this.prune();
    const token = randomUUID().replaceAll("-", "").slice(0, 16);
    this.entries.set(token, { payload, expiresAt: Date.now() + 120_000, consumed: false });
    return token;
  }

  consume(token: string, actorId: string): ConfirmationPayload {
    const entry = this.entries.get(token);
    if (!entry || entry.expiresAt < Date.now()) throw new Error("This confirmation has expired. Run the command again.");
    if (entry.payload.actorId !== actorId) throw new Error("Only the moderator who opened this confirmation can use it.");
    if (entry.consumed) throw new Error("This action has already been processed.");
    entry.consumed = true;
    return entry.payload;
  }

  cancel(token: string, actorId: string): void {
    const entry = this.entries.get(token);
    if (entry && entry.payload.actorId !== actorId) throw new Error("Only the initiating moderator can cancel this action.");
    this.entries.delete(token);
  }

  private prune(): void {
    for (const [token, entry] of this.entries) if (entry.expiresAt < Date.now()) this.entries.delete(token);
  }
}
