import { Collection, type GuildMember, type Message, type TextChannel } from "discord.js";

import type { ModerationSettings } from "../config/settings.js";
import type { LockRepository } from "../repositories/lock-repository.js";
import { requireCapability } from "../permissions/capabilities.js";
import { validateReason } from "../utils/validation.js";
import { readSendMessagesState } from "../utils/lock-state.js";
import type { CaseRepository } from "../repositories/case-repository.js";

export class ChannelModerationService {
  constructor(private readonly configs: ModerationSettings, private readonly locks: LockRepository, private readonly cases: CaseRepository) {}

  async setSlowmode(channel: TextChannel, actor: GuildMember, seconds: number, reason: string): Promise<void> {
    const config = await this.configs.get(channel.guild.id);
    requireCapability(actor, "moderation.channel.manage", config);
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 21_600) throw new Error("Slowmode must be between 0 and 21,600 seconds.");
    await channel.setRateLimitPerUser(seconds, validateReason(reason));
    await this.cases.audit("channel.slowmode", channel.guild.id, actor.id, undefined, undefined, { channelId: channel.id, seconds, reason });
  }

  async lock(channel: TextChannel, actor: GuildMember, reason: string): Promise<void> {
    const config = await this.configs.get(channel.guild.id);
    requireCapability(actor, "moderation.channel.manage", config);
    if (await this.locks.get(channel.id)) throw new Error("This channel is already locked by the bot.");
    const overwrite = channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id);
    const previous = readSendMessagesState(overwrite);
    await this.locks.save({ channelId: channel.id, guildId: channel.guild.id, actorId: actor.id, previousSendMessages: previous, reason: validateReason(reason) });
    try {
      await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: false }, { reason });
    } catch (error) {
      await this.locks.remove(channel.id);
      throw error;
    }
    await this.cases.audit("channel.locked", channel.guild.id, actor.id, undefined, undefined, { channelId: channel.id, reason });
  }

  async unlock(channel: TextChannel, actor: GuildMember, reason: string): Promise<void> {
    const config = await this.configs.get(channel.guild.id);
    requireCapability(actor, "moderation.channel.manage", config);
    const state = await this.locks.get(channel.id);
    if (!state) throw new Error("No bot-managed lock state exists for this channel.");
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone, { SendMessages: state.previousSendMessages }, { reason: validateReason(reason) });
    await this.locks.remove(channel.id);
    await this.cases.audit("channel.unlocked", channel.guild.id, actor.id, undefined, undefined, { channelId: channel.id, reason });
  }

  async purge(channel: TextChannel, actor: GuildMember, filters: { count: number; userId?: string; bots?: boolean; links?: boolean; attachments?: boolean; contains?: string }): Promise<{ deleted: number; matched: number; tooOld: number }> {
    const config = await this.configs.get(channel.guild.id);
    requireCapability(actor, "moderation.purge", config);
    const requested = Math.min(Math.max(filters.count, 1), 100);
    const fetched = await channel.messages.fetch({ limit: 100 });
    const matches = fetched.filter((message) => {
      if (message.pinned) return false;
      if (filters.userId && message.author.id !== filters.userId) return false;
      if (filters.bots && !message.author.bot) return false;
      if (filters.links && !/https?:\/\/\S+/i.test(message.content)) return false;
      if (filters.attachments && message.attachments.size === 0) return false;
      if (filters.contains && !message.content.toLowerCase().includes(filters.contains.toLowerCase())) return false;
      return true;
    }).first(requested);
    const cutoff = Date.now() - 14 * 86_400_000;
    const deletable = new Collection<string, Message<true>>();
    for (const message of matches) if (message.createdTimestamp > cutoff) deletable.set(message.id, message);
    const deleted = deletable.size > 0 ? await channel.bulkDelete(deletable, false) : deletable;
    await this.cases.audit("messages.purged", channel.guild.id, actor.id, undefined, filters.userId, { channelId: channel.id, requested, matched: matches.length, deleted: deleted.size, tooOld: matches.length - deletable.size, filters });
    return { deleted: deleted.size, matched: matches.length, tooOld: matches.length - deletable.size };
  }
}
