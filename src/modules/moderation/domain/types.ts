import type { ModerationCase } from "../database/schema.js";

export type ModerationAction = ModerationCase["action"];
export type ModerationCaseStatus = ModerationCase["status"];

export interface CaseSource {
  readonly channelId?: string;
  readonly messageId?: string;
  readonly url?: string;
}

export interface CaseHistoryPage {
  readonly cases: ModerationCase[];
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
  readonly notes: number;
  readonly active: number;
}
