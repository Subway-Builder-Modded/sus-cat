import { randomUUID } from "node:crypto";

import type { ModerationCase } from "../database/schema.js";

interface SearchSession {
  readonly actorId: string;
  readonly guildId: string;
  readonly results: ModerationCase[];
  readonly expiresAt: number;
}

export class SearchSessionStore {
  private readonly sessions = new Map<string, SearchSession>();

  create(actorId: string, guildId: string, results: ModerationCase[]): string {
    const token = randomUUID().replaceAll("-", "").slice(0, 16);
    this.sessions.set(token, { actorId, guildId, results, expiresAt: Date.now() + 600_000 });
    return token;
  }

  get(token: string, actorId: string, guildId: string): ModerationCase[] {
    const session = this.sessions.get(token);
    if (!session || session.expiresAt < Date.now()) throw new Error("This search has expired. Run `/case search` again.");
    if (session.actorId !== actorId || session.guildId !== guildId) throw new Error("This search belongs to another moderator or server.");
    return session.results;
  }
}
