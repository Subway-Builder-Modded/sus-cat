import type { Guild, GuildMember, User } from "discord.js";

import { toError } from "../../../core/shared/to-error.js";
import { logger } from "../../../core/shared/logger.js";
import type { ModerationCaseEntry, ModerationCustomCaseType, ModerationUserCase } from "../database/schema.js";
import type { ModerationAction } from "../domain/types.js";
import { validateTargetHierarchy } from "../permissions/hierarchy.js";
import type { CaseRepository } from "../repositories/case-repository.js";
import type { ActionReceiptRepository } from "../repositories/action-receipt-repository.js";
import type { AuditRepository } from "../repositories/audit-repository.js";
import type { ModerationSettings } from "../config/settings.js";
import { validateReason } from "../utils/validation.js";
import { notifyUserBestEffort, publishActionBestEffort, type ActionDelivery, type PublishedActionInput } from "./action-delivery.js";
import { recordAuditIfEnabled } from "./audit-service.js";

export interface ActionContext {
  guild: Guild;
  actor: GuildMember;
  target: GuildMember;
  idempotencyKey: string;
  reason: string;
  silent?: boolean;
  customType?: ModerationCustomCaseType;
}

export interface ActionOutcome {
  readonly action: ModerationAction;
  readonly case?: ModerationUserCase;
  readonly entry?: ModerationCaseEntry;
  readonly dmDelivered?: boolean;
}

export class ModerationService {
  constructor(
    private readonly cases: CaseRepository,
    private readonly receipts: ActionReceiptRepository,
    private readonly audits: AuditRepository,
    private readonly configs: ModerationSettings,
    private readonly delivery: ActionDelivery,
  ) {}

  warn(context: ActionContext): Promise<ActionOutcome> { return this.perform(context, "warn", async () => undefined); }
  timeout(context: ActionContext, durationMs: number): Promise<ActionOutcome> {
    return this.perform(context, "timeout", () => context.target.timeout(durationMs, validateReason(context.reason)), { durationMs, expiresAt: new Date(Date.now() + durationMs) });
  }
  untimeout(context: ActionContext): Promise<ActionOutcome> {
    return this.perform(context, "untimeout", () => context.target.timeout(null, validateReason(context.reason)));
  }
  kick(context: ActionContext): Promise<ActionOutcome> {
    return this.perform(context, "kick", () => context.target.kick(validateReason(context.reason)), { notifyBefore: true });
  }
  ban(context: ActionContext, deleteMessageSeconds = 0): Promise<ActionOutcome> {
    return this.perform(context, "ban", () => context.guild.members.ban(context.target.id, { reason: validateReason(context.reason), deleteMessageSeconds }), { notifyBefore: true, metadata: { deleteMessageSeconds } });
  }

  async unban(input: Omit<ActionContext, "target"> & { target: User }): Promise<ActionOutcome> {
    const reason = validateReason(input.reason);
    if (!await this.receipts.reserve({ guildId: input.guild.id, actorId: input.actor.id, targetUserId: input.target.id, idempotencyKey: input.idempotencyKey, action: "unban" })) {
      const duplicate = await this.cases.findEntryByIdempotency(input.guild.id, input.idempotencyKey);
      if (duplicate) return { action: "unban", ...duplicate };
      throw new Error("This interaction has already been processed.");
    }
    await input.guild.members.unban(input.target.id, reason);
    try { return await this.finish({ guild: input.guild, actor: input.actor, idempotencyKey: input.idempotencyKey, ...(input.silent === undefined ? {} : { silent: input.silent }), ...(input.customType ? { customType: input.customType } : {}) }, "unban", input.target, { reason }); }
    catch (error: unknown) { throw this.persistenceFailure("unban", input.guild.id, input.actor.id, input.target.id, error); }
  }

  async nickname(context: Omit<ActionContext, "reason">, nickname: string | null): Promise<void> {
    const bot = context.guild.members.me;
    if (!bot) throw new Error("Bot member information is unavailable.");
    validateTargetHierarchy(context.actor, context.target, bot);
    if (!await this.receipts.reserve({ guildId: context.guild.id, actorId: context.actor.id, targetUserId: context.target.id, idempotencyKey: context.idempotencyKey, action: "nickname" })) throw new Error("This interaction has already been processed.");
    const before = context.target.nickname ?? context.target.displayName;
    await context.target.setNickname(nickname);
    await recordAuditIfEnabled(this.configs, this.audits, { eventType: "member.nickname", guildId: context.guild.id, actorId: context.actor.id, targetUserId: context.target.id, metadata: { before, after: nickname } });
    await this.publish(context.guild, "nickname", context.actor, context.target.user, { details: [{ name: "Before", value: before, inline: true }, { name: "After", value: nickname ?? "Server default", inline: true }] });
  }

  private async perform(context: ActionContext, action: ModerationAction, operation: () => Promise<unknown>, options: { durationMs?: number; expiresAt?: Date; notifyBefore?: boolean; metadata?: Record<string, unknown> } = {}): Promise<ActionOutcome> {
    const reason = validateReason(context.reason);
    const bot = context.guild.members.me;
    if (!bot) throw new Error("Bot member information is unavailable.");
    validateTargetHierarchy(context.actor, context.target, bot);
    if (!await this.receipts.reserve({ guildId: context.guild.id, actorId: context.actor.id, targetUserId: context.target.id, idempotencyKey: context.idempotencyKey, action })) {
      const duplicate = await this.cases.findEntryByIdempotency(context.guild.id, context.idempotencyKey);
      if (duplicate) return { action, ...duplicate };
      throw new Error("This interaction has already been processed.");
    }
    const notifications = await this.configs.feature(context.guild.id, "user-notifications");
    let dmDelivered: boolean | undefined;
    if (notifications && !context.silent && options.notifyBefore) dmDelivered = await this.notify(context.guild, context.target.user, action, reason, options);
    try { await operation(); }
    catch (error: unknown) {
      await recordAuditIfEnabled(this.configs, this.audits, { eventType: "action.failed", guildId: context.guild.id, actorId: context.actor.id, targetUserId: context.target.id, metadata: { action, error: toError(error).name }, sourceEventId: `failed:${context.idempotencyKey}` });
      throw error;
    }
    if (notifications && !context.silent && !options.notifyBefore) dmDelivered = await this.notify(context.guild, context.target.user, action, reason, options);
    try { return await this.finish(context, action, context.target.user, { reason, ...options, ...(dmDelivered === undefined ? {} : { dmDelivered }) }); }
    catch (error: unknown) {
      if (action === "warn") throw error;
      throw this.persistenceFailure(action, context.guild.id, context.actor.id, context.target.id, error);
    }
  }

  private async finish(context: Omit<ActionContext, "target" | "reason">, action: ModerationAction, target: User, options: { reason: string; durationMs?: number; expiresAt?: Date; metadata?: Record<string, unknown>; dmDelivered?: boolean }): Promise<ActionOutcome> {
    let record: { case: ModerationUserCase; entry: ModerationCaseEntry } | undefined;
    if (!context.silent && await this.configs.feature(context.guild.id, "cases")) record = await this.cases.append({ guildId: context.guild.id, targetUserId: target.id, actorId: context.actor.id, action, reason: options.reason, idempotencyKey: context.idempotencyKey, metadata: { ...(options.metadata ?? {}), ...(options.expiresAt ? { expiresAt: options.expiresAt.toISOString() } : {}) }, ...(options.durationMs ? { durationMs: options.durationMs } : {}), ...(context.customType ? { customType: context.customType } : {}) });
    await recordAuditIfEnabled(this.configs, this.audits, { eventType: "action.completed", guildId: context.guild.id, actorId: context.actor.id, ...(record ? { caseId: record.case.id, caseEntryId: record.entry.id } : {}), targetUserId: target.id, metadata: { action, silent: Boolean(context.silent), dmDelivered: options.dmDelivered, ...options.metadata }, sourceEventId: `completed:${context.idempotencyKey}` });
    await this.publish(context.guild, action, context.actor, target, { reason: options.reason, ...(options.durationMs ? { durationMs: options.durationMs } : {}), ...(record ? { case: record.case, entry: record.entry } : {}) });
    return { action, ...(record ?? {}), ...(options.dmDelivered === undefined ? {} : { dmDelivered: options.dmDelivered }) };
  }

  private async notify(guild: Guild, user: User, action: ModerationAction, reason: string, options: { durationMs?: number; expiresAt?: Date }): Promise<boolean> {
    return notifyUserBestEffort(this.delivery, user, { action, guild, reason, ...options });
  }

  private async publish(guild: Guild, action: ModerationAction | "nickname", actor: GuildMember, target: User, details: Omit<PublishedActionInput, "action" | "actor" | "target">): Promise<void> {
    await publishActionBestEffort(this.configs, this.delivery, guild, { ...details, action, actor, target });
  }

  private persistenceFailure(action: ModerationAction, guildId: string, actorId: string, targetUserId: string, error: unknown): Error {
    logger.error("Discord moderation action succeeded but persistence failed", { action, guildId, actorId, targetUserId, error: toError(error).message });
    return new Error(`The ${action} succeeded in Discord, but its case record could not be saved. Do not repeat the action; review the audit record.`, { cause: error });
  }
}
