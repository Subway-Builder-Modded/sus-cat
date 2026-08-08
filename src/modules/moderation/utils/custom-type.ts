export function parseHexColor(value: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(value.trim())) throw new Error("Color must use #RRGGBB format.");
  return Number.parseInt(value.trim().slice(1), 16);
}

export function validateEmoji(value: string): string {
  const emoji = value.trim();
  if (!emoji || (!/\p{Extended_Pictographic}/u.test(emoji) && !/^<a?:[A-Za-z0-9_]{2,32}:\d{17,20}>$/.test(emoji))) throw new Error("Provide a valid Unicode emoji or custom Discord emoji.");
  return emoji;
}

export function normalizeTypeName(value: string): string { return value.trim().toLocaleLowerCase("en-US"); }
