import { PermissionFlagsBits } from "discord.js";

import type { BotClient } from "../../../core/bot/bot-client.js";
import type { ActionContext, ActionOutcome } from "../services/moderation-service.js";
import { moderation } from "../interactions/context.js";
import { MAX_TIMEOUT_MS, parseDuration } from "../utils/duration.js";

export const caseActionChoices = [
  { name: "None - record only", value: "none" },
  { name: "Warning", value: "warn" },
  { name: "Timeout", value: "timeout" },
  { name: "Kick", value: "kick" },
  { name: "Ban", value: "ban" },
  { name: "Create private case channel", value: "create_channel" },
] as const;

export type CaseCreateAction = (typeof caseActionChoices)[number]["value"];
export type CaseDiscordAction = Exclude<CaseCreateAction, "none" | "create_channel">;

export function parseCaseCreateAction(value: string): CaseCreateAction {
  const action = caseActionChoices.find((choice) => choice.value === value)?.value;
  if (!action) throw new Error("That case action is invalid.");
  return action;
}

export function caseActionFeature(action: CaseDiscordAction): "bans" | "kicks" | "timeouts" | "warnings" {
  if (action === "ban") return "bans";
  if (action === "kick") return "kicks";
  if (action === "timeout") return "timeouts";
  return "warnings";
}

export function caseActionPermission(action: CaseDiscordAction): bigint {
  if (action === "ban") return PermissionFlagsBits.BanMembers;
  if (action === "kick") return PermissionFlagsBits.KickMembers;
  return PermissionFlagsBits.ModerateMembers;
}

export async function performCaseAction(client: BotClient, action: CaseDiscordAction, context: ActionContext, duration: string | null): Promise<ActionOutcome> {
  const service = moderation(client).moderation;
  if (action === "warn") return service.warn(context);
  if (action === "timeout") return service.timeout(context, parseDuration(duration ?? "", MAX_TIMEOUT_MS));
  if (action === "kick") return service.kick(context);
  return service.ban(context);
}
