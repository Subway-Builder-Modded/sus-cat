import { Collection, type GuildMember, type Message, type TextChannel } from "discord.js";

import type { ModerationSettings } from "../config/settings.js";
import type { ActionReceiptRepository } from "../repositories/action-receipt-repository.js";
import type { AuditRepository } from "../repositories/audit-repository.js";
import { publishActionBestEffort, type ActionDelivery } from "./action-delivery.js";
import { recordAuditIfEnabled } from "./audit-service.js";

export interface PurgeFilters { count: number; userId?: string; bots?: boolean; links?: boolean; attachments?: boolean; contains?: string }
export interface PurgePreview { matched: number; channels: number; scanned: number; tooOld: number }

export class PurgeService {
  constructor(
    private readonly configs: ModerationSettings,
    private readonly receipts: ActionReceiptRepository,
    private readonly audits: AuditRepository,
    private readonly delivery: ActionDelivery,
  ) {}

  async preview(channels: readonly TextChannel[], filters: PurgeFilters): Promise<PurgePreview> {
    const firstChannel = channels[0];
    if (!firstChannel) throw new Error("No accessible text channels were selected.");
    const config = await this.configs.get(firstChannel.guild.id);
    const scan = await this.scan(channels, filters, config.purgeScanLimit);
    return { matched: scan.matches.length, channels: new Set(scan.matches.map((message) => message.channelId)).size, scanned: scan.scanned, tooOld: scan.tooOld };
  }

  async execute(channels: readonly TextChannel[], actor: GuildMember, filters: PurgeFilters, idempotencyKey: string): Promise<{ deleted: number; matched: number; tooOld: number; failed: number; channels: number }> {
    if (!channels.length) throw new Error("No accessible text channels were selected.");
    if (!await this.receipts.reserve({ guildId: actor.guild.id, actorId: actor.id, ...(filters.userId ? { targetUserId: filters.userId } : {}), idempotencyKey, action: "purge" })) throw new Error("This purge has already been processed.");
    const config = await this.configs.get(actor.guild.id);
    const scan = await this.scan(channels, filters, config.purgeScanLimit);
    let deleted = 0;
    let failed = 0;
    for (const channel of channels) {
      const messages = new Collection<string, Message<true>>();
      for (const message of scan.matches.filter((item) => item.channelId === channel.id && item.createdTimestamp > Date.now() - 14 * 86_400_000)) messages.set(message.id, message);
      for (const batch of chunk([...messages.values()], 100)) {
        try { deleted += (await channel.bulkDelete(new Collection(batch.map((message) => [message.id, message])), false)).size; }
        catch { failed += batch.length; }
      }
    }
    await recordAuditIfEnabled(this.configs, this.audits, { eventType: "messages.purged", guildId: actor.guild.id, actorId: actor.id, ...(filters.userId ? { targetUserId: filters.userId } : {}), metadata: { channelIds: channels.map((channel) => channel.id), matched: scan.matches.length, deleted, failed, tooOld: scan.tooOld, filters }, sourceEventId: `purge:${idempotencyKey}` });
    await publishActionBestEffort(this.configs, this.delivery, actor.guild, { action: "purge", actor, result: `${deleted} deleted across ${channels.length} channel${channels.length === 1 ? "" : "s"}`, details: [{ name: "Matched", value: String(scan.matches.length), inline: true }, { name: "Too old", value: String(scan.tooOld), inline: true }, { name: "Failed", value: String(failed), inline: true }] });
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

function chunk<T>(values: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size));
}
