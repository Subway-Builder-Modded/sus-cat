export function purgeSummary(result: { deleted: number; matched: number; tooOld: number; failed: number; channels: number }): string {
  return `Deleted **${result.deleted}** of **${result.matched}** matches across **${result.channels}** channel${result.channels === 1 ? "" : "s"}.${result.tooOld ? ` ${result.tooOld} were older than 14 days.` : ""}${result.failed ? ` ${result.failed} failed Discord deletion and were not counted as deleted.` : ""}`;
}
