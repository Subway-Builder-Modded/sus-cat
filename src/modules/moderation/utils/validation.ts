export function validateReason(value: string): string {
  const reason = value.trim();
  if (reason.length < 3) throw new Error("Provide a meaningful reason of at least 3 characters.");
  if (reason.length > 1_000) throw new Error("Reasons cannot exceed 1,000 characters.");
  return reason;
}

export function truncate(value: string, maximum: number): string {
  return value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;
}

export function parseSnowflake(value: string): string {
  const match = value.trim().match(/^<?@?!?(\d{17,20})>?$/);
  if (!match?.[1]) throw new Error("Enter a valid Discord user ID.");
  return match[1];
}

export function safeUrl(value: string): string {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Only HTTP(S) URLs are supported.");
  return url.href;
}
