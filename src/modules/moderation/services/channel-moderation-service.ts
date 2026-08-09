import type { GuildMember, GuildTextBasedChannel, TextChannel } from "discord.js";

import type { ModerationSettings } from "../config/settings.js";
import type { LockRepository } from "../repositories/lock-repository.js";
import { readSendMessagesState } from "../utils/lock-state.js";
import type { ActionReceiptRepository } from "../repositories/action-receipt-repository.js";
import type { AuditRepository } from "../repositories/audit-repository.js";
import { publishActionBestEffort, type ActionDelivery } from "./action-delivery.js";
import { recordAuditIfEnabled } from "./audit-service.js";

export class ChannelModerationService {
  constructor(
    private readonly configs: ModerationSettings,
    private readonly locks: LockRepository,
    private readonly receipts: ActionReceiptRepository,
    private readonly audits: AuditRepository,
    private readonly delivery: ActionDelivery,
  ) {}

  async setSlowmode(channel: TextChannel, actor: GuildMember, seconds: number): Promise<{ before: number; after: number }> {
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 21_600) throw new Error("Slowmode must be between 0 and 21,600 seconds.");
    const before = channel.rateLimitPerUser;
    await channel.setRateLimitPerUser(seconds);
    await recordAuditIfEnabled(this.configs, this.audits, { eventType: "channel.slowmode", guildId: channel.guild.id, actorId: actor.id, metadata: { channelId: channel.id, before, after: seconds } });
    await publishActionBestEffort(this.configs, this.delivery, channel.guild, { action: "slowmode", actor, result: `${channel}`, details: [{ name: "Before", value: `${before} seconds`, inline: true }, { name: "After", value: `${seconds} seconds`, inline: true }] });
    return { before, after: seconds };
  }

  async lock(channel: TextChannel, actor: GuildMember, reason?: string): Promise<void> {
    const previous = readSendMessagesState(channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id));
    const state = { channelId: channel.id, guildId: channel.guild.id, actorId: actor.id, previousSendMessages: previous, reason: reason ?? null };
    if (!await this.locks.create(state)) throw new Error("This channel is already locked by the bot.");
    try { await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: false }, { ...(reason ? { reason } : {}) }); }
    catch (error) { await this.locks.take(channel.guild.id, channel.id); throw error; }
    await recordAuditIfEnabled(this.configs, this.audits, { eventType: "channel.locked", guildId: channel.guild.id, actorId: actor.id, metadata: { channelId: channel.id, reason } });
    await publishActionBestEffort(this.configs, this.delivery, channel.guild, { action: "lock", actor, result: `${channel}`, ...(reason ? { reason } : {}) });
  }

  async unlock(channel: TextChannel, actor: GuildMember, reason?: string): Promise<void> {
    const state = await this.locks.take(channel.guild.id, channel.id);
    if (!state) throw new Error("No bot-managed lock state exists for this channel.");
    try { await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: state.previousSendMessages }, { ...(reason ? { reason } : {}) }); }
    catch (error) { await this.locks.restore(state); throw error; }
    await recordAuditIfEnabled(this.configs, this.audits, { eventType: "channel.unlocked", guildId: channel.guild.id, actorId: actor.id, metadata: { channelId: channel.id, reason } });
    await publishActionBestEffort(this.configs, this.delivery, channel.guild, { action: "unlock", actor, result: `${channel}`, ...(reason ? { reason } : {}) });
  }

  async sendAsBot(channel: GuildTextBasedChannel, actor: GuildMember, content: string, idempotencyKey: string): Promise<void> {
    if (!await this.receipts.reserve({ guildId: actor.guild.id, actorId: actor.id, idempotencyKey, action: "sudo" })) throw new Error("This interaction has already been processed.");
    const message = await channel.send({ content, allowedMentions: { parse: [] } });
    await recordAuditIfEnabled(this.configs, this.audits, { eventType: "sudo.message", guildId: actor.guild.id, actorId: actor.id, metadata: { channelId: channel.id, messageId: message.id }, sourceEventId: `sudo:${idempotencyKey}` });
    await publishActionBestEffort(this.configs, this.delivery, actor.guild, { action: "sudo", actor, result: `${channel}`, details: [{ name: "Message ID", value: `\`${message.id}\``, inline: true }] });
  }

}
