import type { ModerationCaseStatus } from "./types.js";

const transitions: Record<ModerationCaseStatus, readonly ModerationCaseStatus[]> = {
  pending: ["active", "failed", "voided"],
  active: ["expired", "reversed", "voided", "superseded", "failed"],
  expired: ["voided"],
  reversed: ["voided"],
  voided: [],
  superseded: ["voided"],
  failed: ["voided"],
};

export function canTransitionCase(from: ModerationCaseStatus, to: ModerationCaseStatus): boolean {
  return transitions[from].includes(to);
}
