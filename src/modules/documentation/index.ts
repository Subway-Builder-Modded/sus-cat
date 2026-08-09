import type { BotModule } from "../../core/modules/types.js";
import help from "./commands/help.js";
import { handleDocumentationComponent } from "./interactions/handler.js";
import { documentationManifest } from "./manifest.js";

export const documentationModule = {
  manifest: documentationManifest,
  commands: [help],
  featureForComponent: (action) => action.startsWith("search") ? "search" : undefined,
  componentAcknowledgement: (action) => action === "search" ? "modal" : "defer-update",
  handleComponent: handleDocumentationComponent,
} satisfies BotModule;
