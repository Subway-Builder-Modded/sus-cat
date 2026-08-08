import { DiscordAPIError } from "discord.js";

import { toError } from "../../../core/shared/to-error.js";

export function publicErrorMessage(value: unknown): string {
  if (!(value instanceof DiscordAPIError)) return toError(value).message;
  const messages: Record<number, string> = {
    10007: "That member is no longer in the server.",
    10008: "That message no longer exists.",
    10013: "That user could not be found.",
    10026: "That ban could not be found.",
    50013: "Discord denied the action because the bot lacks permission or its role is too low.",
    50035: "Discord rejected one of the provided values. Check the duration and message deletion window.",
  };
  return messages[Number(value.code)] ?? "Discord rejected the moderation action. Check the bot's permissions and role position.";
}
