import { PermissionFlagsBits } from "discord.js";

interface PermissionValues {
  has(permission: bigint): boolean;
}

export function readSendMessagesState(overwrite?: { allow: PermissionValues; deny: PermissionValues }): boolean | null {
  if (overwrite?.allow.has(PermissionFlagsBits.SendMessages)) return true;
  if (overwrite?.deny.has(PermissionFlagsBits.SendMessages)) return false;
  return null;
}
