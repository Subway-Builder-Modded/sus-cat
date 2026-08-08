import type { BotModule } from "../../core/modules/types.js";
import { moderationCommands } from "./commands/index.js";
import { handleModerationComponent } from "./interactions/component-router.js";
import { moderationManifest } from "./manifest.js";
import { hasCapability } from "./permissions/capabilities.js";
import type { Capability } from "./permissions/capabilities.js";

export const moderationModule = {
  manifest: moderationManifest,
  commands: moderationCommands,
  async hasCapability(client, guildId, userId, capability) {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    return hasCapability(member, capability as Capability, await client.moderation!.configs.get(guildId));
  },
  featureForComponent(action) {
    if (action.includes("msg_delete")) return "purge";
    if (action.includes("msg_warn") || action.includes("quick_warn")) return "warnings";
    if (action.includes("msg_timeout") || action.includes("quick_timeout")) return "timeouts";
    if (action.includes("quick_kick")) return "kicks";
    if (action.includes("quick_ban")) return "bans";
    if (action.includes("evidence")) return "evidence";
    if (action.includes("case_note")) return "notes";
    if (action.startsWith("history") || action.startsWith("case_")) return "case-management";
    if (action.startsWith("quick_") || action.startsWith("modal_quick_")) return "notes";
    return "case-management";
  },
  handleComponent: handleModerationComponent,
} satisfies BotModule;
