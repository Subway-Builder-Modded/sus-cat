const units = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
} as const;

export const MAX_TIMEOUT_MS = 28 * units.d;

export function parseDuration(input: string, maximum = Number.MAX_SAFE_INTEGER): number {
  const normalized = input.trim().toLowerCase();
  const matches = [...normalized.matchAll(/(\d+)\s*([smhdw])/g)];
  if (matches.length === 0 || matches.map((match) => match[0]).join("") !== normalized.replaceAll(" ", "")) {
    throw new Error("Use a duration such as `10m`, `2h`, `1d`, or `1w 2d`.");
  }

  const duration = matches.reduce((total, match) => {
    const amount = Number(match[1]);
    const unit = match[2];
    if (!isDurationUnit(unit)) throw new Error("The duration contains an unsupported unit.");
    return total + amount * units[unit];
  }, 0);

  if (!Number.isSafeInteger(duration) || duration < 1_000) throw new Error("Duration must be at least 1 second.");
  if (duration > maximum) throw new Error(`Duration cannot exceed ${formatDuration(maximum)}.`);
  return duration;
}

function isDurationUnit(value: string | undefined): value is keyof typeof units {
  return value !== undefined && Object.hasOwn(units, value);
}

export function formatDuration(milliseconds: number): string {
  const parts: string[] = [];
  let remaining = Math.max(0, Math.floor(milliseconds / 1_000));
  for (const [label, seconds] of [["week", 604_800], ["day", 86_400], ["hour", 3_600], ["minute", 60], ["second", 1]] as const) {
    const amount = Math.floor(remaining / seconds);
    if (amount > 0) {
      parts.push(`${amount} ${label}${amount === 1 ? "" : "s"}`);
      remaining %= seconds;
    }
    if (parts.length === 2) break;
  }
  return parts.join(" ") || "0 seconds";
}
