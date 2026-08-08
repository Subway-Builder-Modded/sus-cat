import type { ModerationCaseEntry, ModerationUserCase } from "../database/schema.js";

export type ModerationAction = ModerationCaseEntry["action"];
export type EvidenceResult = "none" | "warn" | "timeout" | "kick" | "ban" | "unban" | "untimeout";

export interface UserCasePage {
  readonly case: ModerationUserCase;
  readonly entries: ModerationCaseEntry[];
  readonly total: number;
  readonly page: number;
  readonly pages: number;
}

export interface HistorySummary {
  readonly total: number;
  readonly warnings: number;
  readonly timeouts: number;
  readonly kicks: number;
  readonly bans: number;
  readonly unbans: number;
  readonly evidence: number;
}
