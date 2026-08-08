import type { ModerationCaseStatus } from "./types.js";

export function isScheduledCaseActionable(status: ModerationCaseStatus | undefined): boolean {
  return status === "active";
}
