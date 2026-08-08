import { EmbedBuilder, type Guild, type GuildMember, type User } from "discord.js";

import type { ModerationCase, ModerationConfig } from "../database/schema.js";
import { logger } from "../../../core/shared/logger.js";
import { toError } from "../../../core/shared/to-error.js";
import type { CaseSource, ModerationAction } from "../domain/types.js";
import type { Capability } from "../permissions/capabilities.js";
import { requireCapability } from "../permissions/capabilities.js";
import { validateTargetHierarchy } from "../permissions/hierarchy.js";
import type { CaseRepository } from "../repositories/case-repository.js";
import type { ModerationSettings } from "../config/settings.js";
import { buildCaseEmbed } from "../ui/case-embed.js";
import { caseControls } from "../ui/case-controls.js";
import { moderationColors } from "../ui/theme.js";
import { formatDuration } from "../utils/duration.js";
import { validateReason } from "../utils/validation.js";

interface ActionContext {
  guild: Guild;
  actor: GuildMember;
  target: GuildMember;
  idempotencyKey: string;
  reason: string;
  source?: CaseSource;
}

export class ModerationService {
  constructor(private readonly cases: CaseRepository, private readonly configs: ModerationSettings) {}

  async warn(context: ActionContext): Promise<ModerationCase> {
    return this.recordOnly(context, "warn", "moderation.warn", true);
  }

  async note(context: ActionContext): Promise<ModerationCase> {
    const config = await this.authorize(context, "moderation.note", false);
    if (!config.notesEnabled) throw new Error("Staff notes are disabled in this server.");
    const item = await this.cases.create({ ...baseCase(context, "note"), internalNote: validateReason(context.reason) });
    if (item.status !== "pending") return item;
    await this.cases.addNote({ guildId: context.guild.id, targetUserId: context.target.id, actorId: context.actor.id, content: item.reason, caseId: item.id });
    const active = await this.cases.transition(item.id, "active", context.actor.id);
    await this.publishLog(context.guild, config, active, true);
    return active;
  }

  async timeout(context: ActionContext, durationMs: number): Promise<ModerationCase> {
    const expiresAt = new Date(Date.now() + durationMs);
    const item = await this.execute(context, "timeout", "moderation.timeout", { durationMs, expiresAt }, async () => {
      await context.target.timeout(durationMs, validateReason(context.reason));
    });
    await this.cases.schedule(item.id, item.guildId, item.targetUserId, "timeout_expire", expiresAt);
    return item;
  }

  async untimeout(context: ActionContext, relatedCaseId?: string): Promise<ModerationCase> {
    return this.execute(context, "untimeout", "moderation.timeout", { ...(relatedCaseId ? { relatedCaseId } : {}) }, async () => {
      await context.target.timeout(null, validateReason(context.reason));
    });
  }

  async kick(context: ActionContext): Promise<ModerationCase> {
    return this.execute(context, "kick", "moderation.kick", {}, () => context.target.kick(validateReason(context.reason)));
  }

  async ban(context: ActionContext, options: { deleteMessageSeconds?: number; durationMs?: number } = {}): Promise<ModerationCase> {
    if (options.durationMs) {
      const config = await this.configs.get(context.guild.id);
      if (!config.temporaryBansEnabled) throw new Error("Temporary bans are disabled in this server.");
    }
    const item = await this.execute(context, "ban", "moderation.ban", {
      ...(options.durationMs ? { durationMs: options.durationMs, expiresAt: new Date(Date.now() + options.durationMs) } : {}),
    }, () => context.guild.members.ban(context.target.id, { reason: validateReason(context.reason), deleteMessageSeconds: options.deleteMessageSeconds ?? 0 }));
    if (options.durationMs && item.expiresAt) await this.cases.schedule(item.id, item.guildId, item.targetUserId, "unban", item.expiresAt);
    return item;
  }

  async unban(input: Omit<ActionContext, "target"> & { target: User; relatedCaseId?: string }): Promise<ModerationCase> {
    const config = await this.configs.get(input.guild.id);
    requireCapability(input.actor, "moderation.unban", config);
    const item = await this.cases.create({ ...baseCase(input, "unban"), ...(input.relatedCaseId ? { relatedCaseId: input.relatedCaseId } : {}) });
    try {
      await input.guild.members.unban(input.target.id, validateReason(input.reason));
      const active = await this.cases.transition(item.id, "active", input.actor.id);
      await this.publishLog(input.guild, config, active);
      return active;
    } catch (error: unknown) {
      await this.cases.transition(item.id, "failed", input.actor.id, { error: toError(error).name });
      throw error;
    }
  }

  async softban(context: ActionContext, deleteMessageSeconds = 86_400): Promise<ModerationCase> {
    return this.execute(context, "softban", "moderation.ban", {}, async () => {
      await context.guild.members.ban(context.target.id, { reason: validateReason(context.reason), deleteMessageSeconds });
      await context.guild.members.unban(context.target.id, "Softban completed");
    });
  }

  async nick(context: ActionContext, nickname: string | null): Promise<ModerationCase> {
    return this.execute(context, "nick", "moderation.nick", { metadata: { nickname } }, () => context.target.setNickname(nickname, validateReason(context.reason)));
  }

  async reverseCase(item: ModerationCase, actor: GuildMember, reason: string): Promise<ModerationCase> {
    const config = await this.configs.get(item.guildId);
    const guild = actor.guild;
    if (item.action === "ban") {
      requireCapability(actor, "moderation.unban", config);
      await guild.members.unban(item.targetUserId, validateReason(reason));
    } else if (item.action === "timeout") {
      requireCapability(actor, "moderation.timeout", config);
      const target = await guild.members.fetch(item.targetUserId);
      await target.timeout(null, validateReason(reason));
    } else {
      throw new Error("This case does not represent a reversible active punishment.");
    }
    const reversed = await this.cases.transition(item.id, "reversed", actor.id, { reason });
    await this.cases.cancelScheduled(item.id);
    return reversed;
  }

  private async recordOnly(context: ActionContext, action: ModerationAction, capability: Capability, hierarchy = false): Promise<ModerationCase> {
    const config = await this.authorize(context, capability, hierarchy);
    const item = await this.cases.create(baseCase(context, action));
    if (item.status !== "pending") return item;
    const active = await this.cases.transition(item.id, "active", context.actor.id);
    await this.notifyAndLog(context.guild, context.target.user, config, active);
    return active;
  }

  private async execute(context: ActionContext, action: ModerationAction, capability: Capability, extra: Partial<Parameters<CaseRepository["create"]>[0]>, operation: () => Promise<unknown>): Promise<ModerationCase> {
    const config = await this.authorize(context, capability, true);
    const item = await this.cases.create({ ...baseCase(context, action), ...extra });
    if (item.status !== "pending") return item;
    try {
      await operation();
      const active = await this.cases.transition(item.id, "active", context.actor.id);
      await this.notifyAndLog(context.guild, context.target.user, config, active);
      return active;
    } catch (error: unknown) {
      await this.cases.transition(item.id, "failed", context.actor.id, { error: toError(error).name });
      throw error;
    }
  }

  private async authorize(context: ActionContext, capability: Capability, hierarchy: boolean): Promise<ModerationConfig> {
    const config = await this.configs.get(context.guild.id);
    requireCapability(context.actor, capability, config);
    if (hierarchy) {
      const bot = context.guild.members.me;
      if (!bot) throw new Error("Bot member information is unavailable.");
      validateTargetHierarchy(context.actor, context.target, bot);
    }
    validateReason(context.reason);
    return config;
  }

  private async notifyAndLog(guild: Guild, user: User, config: ModerationConfig, item: ModerationCase): Promise<void> {
    if (!config.dmUsers) {
      await this.cases.recordDm(item.id, "disabled");
    } else {
      try {
        const embed = new EmbedBuilder().setColor(moderationColors.info).setTitle(`Moderation notice from ${guild.name}`).setDescription(item.reason).addFields({ name: "Action", value: item.action.toUpperCase(), inline: true }, { name: "Case", value: `#${item.caseNumber}`, inline: true });
        if (item.durationMs) embed.addFields({ name: "Duration", value: formatDuration(item.durationMs), inline: true });
        if (item.expiresAt) embed.addFields({ name: "Expires", value: `<t:${Math.floor(item.expiresAt.getTime() / 1_000)}:F>` });
        if (config.rulesUrl) embed.addFields({ name: "Server rules", value: config.rulesUrl });
        await user.send({ embeds: [embed], allowedMentions: { parse: [] } });
        await this.cases.recordDm(item.id, "sent");
      } catch (error: unknown) {
        await this.cases.recordDm(item.id, "failed", toError(error).name);
      }
    }
    await this.publishLog(guild, config, item);
  }

  private async publishLog(guild: Guild, config: ModerationConfig, item: ModerationCase, privateOnly = false): Promise<void> {
    const channelId = privateOnly ? config.auditLogChannelId : config.modLogChannelId;
    if (!channelId) return;
    try {
      const channel = await guild.channels.fetch(channelId);
      if (!channel?.isSendable()) return;
      await channel.send({ embeds: [buildCaseEmbed(item)], components: config.caseButtonsEnabled ? [caseControls(item, "any")] : [], allowedMentions: { parse: [] } });
    } catch (error: unknown) {
      logger.warn("Unable to publish moderation log", { guildId: guild.id, caseNumber: item.caseNumber, error: toError(error).message });
    }
  }
}

function baseCase(context: Omit<ActionContext, "target"> & { target: GuildMember | User }, action: ModerationAction) {
  return {
    guildId: context.guild.id,
    targetUserId: context.target.id,
    actorId: context.actor.id,
    action,
    reason: validateReason(context.reason),
    idempotencyKey: context.idempotencyKey,
    ...(context.source ? { source: context.source } : {}),
  };
}
