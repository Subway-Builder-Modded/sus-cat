import type { Guild, GuildMember, User } from "discord.js";

import { logger } from "../../../core/shared/logger.js";
import { toError } from "../../../core/shared/to-error.js";
import type { ModerationCaseEntry, ModerationUserCase } from "../database/schema.js";
import type { ModerationAction } from "../domain/types.js";
import type { ModerationSettings } from "../config/settings.js";

export type PublishedAction = ModerationAction | "nickname" | "slowmode" | "lock" | "unlock" | "purge" | "sudo";

export interface PublishedActionInput {
  readonly action: PublishedAction;
  readonly actor: GuildMember;
  readonly target?: User | GuildMember;
  readonly reason?: string;
  readonly durationMs?: number;
  readonly result?: string;
  readonly case?: ModerationUserCase;
  readonly entry?: ModerationCaseEntry;
  readonly details?: readonly { readonly name: string; readonly value: string; readonly inline?: boolean }[];
}

export interface ActionDelivery {
  notifyUser(user: User, input: { action: ModerationAction; guild: Guild; reason: string; durationMs?: number; expiresAt?: Date; rulesUrl?: string | null }): Promise<boolean>;
  publish(guild: Guild, auditLogChannelId: string, input: PublishedActionInput): Promise<void>;
}

export async function notifyUserBestEffort(settings: ModerationSettings, delivery: ActionDelivery, user: User, input: Parameters<ActionDelivery["notifyUser"]>[1]): Promise<boolean> {
  try {
    const config = await settings.get(input.guild.id);
    return await delivery.notifyUser(user, { ...input, rulesUrl: config.rulesUrl });
  } catch (error: unknown) {
    logger.warn("Unable to deliver moderation notification", { guildId: input.guild.id, userId: user.id, action: input.action, error: toError(error).message });
    return false;
  }
}

export async function publishActionBestEffort(settings: ModerationSettings, delivery: ActionDelivery, guild: Guild, input: PublishedActionInput): Promise<void> {
  try {
    if (!await settings.feature(guild.id, "audit-log")) return;
    const { auditLogChannelId } = await settings.get(guild.id);
    if (auditLogChannelId) await delivery.publish(guild, auditLogChannelId, input);
  } catch (error: unknown) {
    logger.warn("Unable to publish moderation action", { guildId: guild.id, action: input.action, error: toError(error).message });
  }
}
