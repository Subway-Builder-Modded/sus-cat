import type { GuildMember } from "discord.js";

export function validateTargetHierarchy(actor: GuildMember, target: GuildMember, bot: GuildMember): void {
  if (actor.id === target.id) throw new Error("You cannot use this action on yourself.");
  if (target.id === actor.guild.ownerId) throw new Error("The server owner cannot be moderated.");
  if (target.id === bot.id) throw new Error("I cannot moderate myself.");
  if (bot.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    throw new Error("My highest role must be above the target's highest role.");
  }
}
