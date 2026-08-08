import type { BotModule } from "../../core/modules/types.js";
import { moderationCommands } from "./commands/index.js";
import { handleModerationComponent } from "./interactions/component-router.js";
import { moderationManifest } from "./manifest.js";
import { hasModerationAccess } from "./permissions/authorization.js";
import { resetModerationGuild } from "./repositories/case-repository.js";
import { moderationConfigView } from "./ui/config/dashboard.js";
import nativeAuditHandler from "./audit/native-audit-handler.js";

export const moderationModule = {
  manifest: moderationManifest,
  commands: moderationCommands,
  events: [nativeAuditHandler],
  async authorizeCommand(client, interaction, nativePermission) {
    if (!interaction.inCachedGuild()) return false;
    return hasModerationAccess(client, interaction.member, nativePermission);
  },
  isConfigurationComponent: (action) => action.startsWith("config_") || action.startsWith("type_") || action.startsWith("modal_config_") || action.startsWith("modal_type_"),
  featureForComponent(action) {
    if (action === "confirm" || action === "cancel") return undefined;
    if (action.startsWith("config_") || action.startsWith("type_") || action.startsWith("modal_config_") || action.startsWith("modal_type_")) return undefined;
    if (action.includes("evidence")) return "evidence";
    if (action.startsWith("user_")) return "user-management";
    if (action.startsWith("case_")) return "cases";
    return "cases";
  },
  handleComponent: handleModerationComponent,
  configurationView: moderationConfigView,
  resetGuild: (guildId, transaction) => resetModerationGuild(transaction, guildId),
} satisfies BotModule;
