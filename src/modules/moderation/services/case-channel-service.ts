import { ChannelType, PermissionFlagsBits, type Guild, type GuildMember, type User } from "discord.js";

import type { GuildConfigService } from "../../../core/config/service.js";
import type { ModerationCustomCaseType } from "../database/schema.js";
import type { ActionReceiptRepository } from "../repositories/action-receipt-repository.js";
import type { AuditRepository } from "../repositories/audit-repository.js";
import type { CaseRepository } from "../repositories/case-repository.js";
import type { ModerationSettings } from "../config/settings.js";
import { publishActionBestEffort, type ActionDelivery } from "./action-delivery.js";
import { recordAuditIfEnabled } from "./audit-service.js";

export class CaseChannelService {
  constructor(
    private readonly cases: CaseRepository,
    private readonly receipts: ActionReceiptRepository,
    private readonly audits: AuditRepository,
    private readonly configs: ModerationSettings,
    private readonly settings: GuildConfigService,
    private readonly delivery: ActionDelivery,
  ) {}

  async create(input: { guild: Guild; actor: GuildMember; target: User; idempotencyKey: string; reason?: string; customType?: ModerationCustomCaseType }) {
    const { guild, actor, target } = input;
    const isReserved = await this.receipts.reserve({ guildId: guild.id, actorId: actor.id, targetUserId: target.id, idempotencyKey: `case-channel:${input.idempotencyKey}`, action: "create_channel" });
    if (!isReserved) throw new Error("This case channel request has already been processed.");

    const record = await this.cases.append({
      guildId: guild.id,
      targetUserId: target.id,
      actorId: actor.id,
      action: "create_channel",
      idempotencyKey: input.idempotencyKey,
      metadata: { status: "attempted" },
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.customType ? { customType: input.customType } : {}),
    });
    const config = await this.configs.get(guild.id);
    const allowedRoles = [...new Set([...config.moderatorRoleIds, ...await this.settings.botAdminRoleIds(guild.id)])];
    const botUserId = guild.client.user.id;

    let channel;
    try {
      channel = await guild.channels.create({
        name: `case-${record.case.caseNumber}-${sanitizeChannelName(target.username)}`,
        type: ChannelType.GuildText,
        ...(config.caseCategoryId ? { parent: config.caseCategoryId } : {}),
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: target.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          ...allowedRoles.map((id) => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] })),
          { id: botUserId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
        ],
        reason: `Private moderation case #${record.case.caseNumber}`,
      });
    } catch (error: unknown) {
      await this.cases.updateEntryMetadata(guild.id, record.entry.id, { status: "failed" });
      throw error;
    }
    try {
      await this.cases.updateEntryMetadata(guild.id, record.entry.id, { status: "completed", channelId: channel.id });
    } catch (error: unknown) {
      throw new Error(`The case channel ${channel} was created, but its case record could not be updated.`, { cause: error });
    }
    await recordAuditIfEnabled(this.configs, this.audits, { eventType: "case.channel.created", guildId: guild.id, actorId: actor.id, targetUserId: target.id, caseId: record.case.id, caseEntryId: record.entry.id, metadata: { channelId: channel.id }, sourceEventId: `case-channel:${input.idempotencyKey}` });
    await publishActionBestEffort(this.configs, this.delivery, guild, { action: "create_channel", actor, target, ...(input.reason ? { reason: input.reason } : {}), case: record.case, entry: record.entry, result: `${channel}` });
    return record;
  }
}

function sanitizeChannelName(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 60) || "user";
}
