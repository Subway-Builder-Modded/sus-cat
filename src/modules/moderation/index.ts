import type { BotModule } from "../../core/modules/types.js";
import { moderationCommands } from "./commands/index.js";
import { handleModerationComponent } from "./interactions/component-router.js";
import { moderationManifest } from "./manifest.js";
import { hasModerationAccess } from "./permissions/authorization.js";
import { resetModerationGuild } from "./repositories/reset-repository.js";
import { customTypesConfigView } from "./ui/config/custom-types.js";
import nativeAuditHandler from "./audit/native-audit-handler.js";

export const moderationModule = {
  manifest: moderationManifest,
  commands: moderationCommands,
  events: [nativeAuditHandler],
  configurationPages: [{
    id: "custom-case-types",
    label: "Custom Case Types",
    description: "Manage case type names, aliases, colors, and emoji.",
    featureId: "cases",
    view: (_settings, _guildId, actorId) => customTypesConfigView(actorId),
  }],
  async authorizeCommand(client, interaction, nativePermission) {
    if (!interaction.inCachedGuild()) return false;
    return hasModerationAccess(client, interaction.member, nativePermission);
  },
  isConfigurationComponent: (action) => action.startsWith("type_") || action.startsWith("modal_type_"),
  componentAcknowledgement: (action) => ["case_evidence_add", "case_evidence_edit", "type_add", "type_edit"].includes(action) ? "modal" : "defer-update",
  featureForComponent(action) {
    if (action === "confirm" || action === "cancel") return undefined;
    if (action.startsWith("type_") || action.startsWith("modal_type_")) return undefined;
    if (action.includes("evidence")) return "evidence";
    if (action.startsWith("user_")) return "user-management";
    if (action.startsWith("case_")) return "cases";
    return "cases";
  },
  handleComponent: handleModerationComponent,
  resetGuild: (guildId, transaction) => resetModerationGuild(transaction, guildId),
} satisfies BotModule;
