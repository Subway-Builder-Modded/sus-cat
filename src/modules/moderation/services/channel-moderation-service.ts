import { Collection, type GuildMember, type GuildTextBasedChannel, type Message, type TextChannel } from "discord.js";

import type { ModerationSettings } from "../config/settings.js";
import type { LockRepository } from "../repositories/lock-repository.js";
import { readSendMessagesState } from "../utils/lock-state.js";
import type { CaseRepository } from "../repositories/case-repository.js";
import { publishAuditLog } from "../ui/actions/audit-log-publisher.js";

export interface PurgeFilters { count: number; userId?: string; bots?: boolean; links?: boolean; attachments?: boolean; contains?: string }
export interface PurgePreview { matched: number; channels: number; scanned: number; tooOld: number }

export class ChannelModerationService {
  constructor(private readonly configs: ModerationSettings, private readonly locks: LockRepository, private readonly cases: CaseRepository) {}

  async setSlowmode(channel: TextChannel, actor: GuildMember, seconds: number): Promise<{ before: number; after: number }> {
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 21_600) throw new Error("Slowmode must be between 0 and 21,600 seconds.");
    const before = channel.rateLimitPerUser;
    await channel.setRateLimitPerUser(seconds);
    if (await this.configs.feature(channel.guild.id, "audit-log")) await this.cases.audit("channel.slowmode", channel.guild.id, actor.id, undefined, undefined, { channelId: channel.id, before, after: seconds });
    await publishAuditLog(this.configs, channel.guild, { action: "slowmode", actor, result: `${channel}`, details: [{ name: "Before", value: `${before} seconds`, inline: true }, { name: "After", value: `${seconds} seconds`, inline: true }] });
    return { before, after: seconds };
  }

  async lock(channel: TextChannel, actor: GuildMember, reason?: string): Promise<void> {
    if (await this.locks.get(channel.id)) throw new Error("This channel is already locked by the bot.");
    const previous = readSendMessagesState(channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id));
    await this.locks.save({ channelId: channel.id, guildId: channel.guild.id, actorId: actor.id, previousSendMessages: previous, reason: reason ?? null });
    try { await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: false }, { ...(reason ? { reason } : {}) }); }
    catch (error) { await this.locks.remove(channel.id); throw error; }
    if (await this.configs.feature(channel.guild.id, "audit-log")) await this.cases.audit("channel.locked", channel.guild.id, actor.id, undefined, undefined, { channelId: channel.id, reason });
    await publishAuditLog(this.configs, channel.guild, { action: "lock", actor, result: `${channel}`, ...(reason ? { reason } : {}) });
  }

  async unlock(channel: TextChannel, actor: GuildMember, reason?: string): Promise<void> {
    const state = await this.locks.get(channel.id);
    if (!state) throw new Error("No bot-managed lock state exists for this channel.");
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: state.previousSendMessages }, { ...(reason ? { reason } : {}) });
    await this.locks.remove(channel.id);
    if (await this.configs.feature(channel.guild.id, "audit-log")) await this.cases.audit("channel.unlocked", channel.guild.id, actor.id, undefined, undefined, { channelId: channel.id, reason });
    await publishAuditLog(this.configs, channel.guild, { action: "unlock", actor, result: `${channel}`, ...(reason ? { reason } : {}) });
  }

  async sendAsBot(channel: GuildTextBasedChannel, actor: GuildMember, content: string, idempotencyKey: string): Promise<void> {
    if (!await this.cases.reserveAction(actor.guild.id, actor.id, undefined, idempotencyKey, "sudo")) throw new Error("This interaction has already been processed.");
    const message = await channel.send({ content, allowedMentions: { parse: [] } });
    if (await this.configs.feature(actor.guild.id, "audit-log")) await this.cases.audit("sudo.message", actor.guild.id, actor.id, undefined, undefined, { channelId: channel.id, messageId: message.id }, undefined, undefined, undefined, `sudo:${idempotencyKey}`);
    await publishAuditLog(this.configs, actor.guild, { action: "sudo", actor, result: `${channel}`, details: [{ name: "Message ID", value: `\`${message.id}\``, inline: true }] });
  }

  async previewPurge(channels: readonly TextChannel[], filters: PurgeFilters): Promise<PurgePreview> {
    const config = await this.configs.get(channels[0]?.guild.id ?? "");
    const scan = await this.scan(channels, filters, config.purgeScanLimit);
    return { matched: scan.matches.length, channels: new Set(scan.matches.map((message) => message.channelId)).size, scanned: scan.scanned, tooOld: scan.tooOld };
  }

  async purge(channels: readonly TextChannel[], actor: GuildMember, filters: PurgeFilters): Promise<{ deleted: number; matched: number; tooOld: number; failed: number; channels: number }> {
    if (!channels.length) throw new Error("No accessible text channels were selected.");
    const config = await this.configs.get(actor.guild.id);
    const scan = await this.scan(channels, filters, config.purgeScanLimit);
    let deleted = 0, failed = 0;
    for (const channel of channels) {
      const messages = new Collection<string, Message<true>>();
      for (const message of scan.matches.filter((item) => item.channelId === channel.id && item.createdTimestamp > Date.now() - 14 * 86_400_000)) messages.set(message.id, message);
      for (const batch of chunk([...messages.values()], 100)) {
        try { deleted += (await channel.bulkDelete(new Collection(batch.map((message) => [message.id, message])), false)).size; }
        catch { failed += batch.length; }
      }
    }
    if (await this.configs.feature(actor.guild.id, "audit-log")) await this.cases.audit("messages.purged", actor.guild.id, actor.id, undefined, filters.userId, { channelIds: channels.map((channel) => channel.id), matched: scan.matches.length, deleted, failed, tooOld: scan.tooOld, filters });
    await publishAuditLog(this.configs, actor.guild, { action: "purge", actor, result: `${deleted} deleted across ${channels.length} channel${channels.length === 1 ? "" : "s"}`, details: [{ name: "Matched", value: String(scan.matches.length), inline: true }, { name: "Too old", value: String(scan.tooOld), inline: true }, { name: "Failed", value: String(failed), inline: true }] });
    return { deleted, matched: scan.matches.length, tooOld: scan.tooOld, failed, channels: new Set(scan.matches.map((message) => message.channelId)).size };
  }

  private async scan(channels: readonly TextChannel[], filters: PurgeFilters, scanLimit: number): Promise<{ matches: Message<true>[]; scanned: number; tooOld: number }> {
    const requested = Math.min(Math.max(filters.count, 1), 1000);
    const matches: Message<true>[] = [];
    let scanned = 0;
    for (const channel of channels.slice(0, 50)) {
      let before: string | undefined;
      while (scanned < scanLimit && matches.length < requested) {
        const fetched = await channel.messages.fetch({ limit: Math.min(100, scanLimit - scanned), ...(before ? { before } : {}) });
        if (!fetched.size) break;
        scanned += fetched.size;
        for (const message of fetched.values()) if (matchesFilter(message, filters)) matches.push(message);
        before = fetched.last()?.id;
        if (fetched.size < 100) break;
      }
      if (scanned >= scanLimit || matches.length >= requested) break;
    }
    const selected = matches.slice(0, requested);
    return { matches: selected, scanned, tooOld: selected.filter((message) => message.createdTimestamp <= Date.now() - 14 * 86_400_000).length };
  }
}

function matchesFilter(message: Message<true>, filters: PurgeFilters): boolean {
  if (message.pinned) return false;
  if (filters.userId && message.author.id !== filters.userId) return false;
  if (filters.bots === true && !message.author.bot) return false;
  if (filters.links === true && !/https?:\/\/\S+/i.test(message.content)) return false;
  if (filters.attachments === true && message.attachments.size === 0) return false;
  if (filters.contains && !message.content.toLocaleLowerCase().includes(filters.contains.toLocaleLowerCase())) return false;
  return true;
}

function chunk<T>(values: T[], size: number): T[][] { return Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size)); }
