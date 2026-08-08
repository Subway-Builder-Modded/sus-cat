import type { ColorResolvable } from "discord.js";
import type { ModerationAction } from "../../domain/types.js";

export interface ModerationActionPresentation {
  readonly label: string;
  readonly emoji: string;
  readonly color: ColorResolvable;
  readonly pastTense: string;
  readonly dmVerb: string;
}

export const actionPresentation: Record<ModerationAction | "nickname" | "slowmode" | "lock" | "unlock" | "purge", ModerationActionPresentation> = {
  ban: { label: "Ban", emoji: "🔨", color: 0xed4245, pastTense: "Banned", dmVerb: "banned from" },
  unban: { label: "Unban", emoji: "🔓", color: 0x57f287, pastTense: "Unbanned", dmVerb: "unbanned from" },
  kick: { label: "Kick", emoji: "🥾", color: 0xf39c12, pastTense: "Kicked", dmVerb: "kicked from" },
  timeout: { label: "Timeout", emoji: "⏳", color: 0xfee75c, pastTense: "Timed out", dmVerb: "timed out in" },
  untimeout: { label: "Remove Timeout", emoji: "⏱️", color: 0x57f287, pastTense: "Timeout removed", dmVerb: "no longer timed out in" },
  warn: { label: "Warning", emoji: "⚠️", color: 0x3498db, pastTense: "Warned", dmVerb: "warned in" },
  manual: { label: "Manual Entry", emoji: "📝", color: 0x95a5a6, pastTense: "Recorded", dmVerb: "notified in" },
  create_channel: { label: "Case Channel", emoji: "💬", color: 0x5865f2, pastTense: "Channel created", dmVerb: "notified in" },
  legacy_note: { label: "Legacy Staff Note", emoji: "📜", color: 0x95a5a6, pastTense: "Imported", dmVerb: "notified in" },
  legacy_softban: { label: "Legacy Softban", emoji: "📜", color: 0x95a5a6, pastTense: "Imported", dmVerb: "notified in" },
  legacy_automated: { label: "Legacy Automated Action", emoji: "📜", color: 0x95a5a6, pastTense: "Imported", dmVerb: "notified in" },
  nickname: { label: "Nickname", emoji: "✏️", color: 0x9b59b6, pastTense: "Nickname updated", dmVerb: "updated in" },
  slowmode: { label: "Slowmode", emoji: "🐢", color: 0x607d8b, pastTense: "Slowmode updated", dmVerb: "updated in" },
  lock: { label: "Channel Lock", emoji: "🔒", color: 0x607d8b, pastTense: "Locked", dmVerb: "updated in" },
  unlock: { label: "Channel Unlock", emoji: "🔑", color: 0x57f287, pastTense: "Unlocked", dmVerb: "updated in" },
  purge: { label: "Purge", emoji: "🧹", color: 0xe67e22, pastTense: "Purged", dmVerb: "updated in" },
};
