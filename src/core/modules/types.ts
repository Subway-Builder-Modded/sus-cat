import type { ClientEvents, PermissionResolvable } from "discord.js";

import type { BotCommand } from "../commands/command.js";
import type { ConfigDefinition } from "../config/definitions.js";
import type { BotClient } from "../bot/bot-client.js";
import type { RoutedComponentInteraction } from "../interactions/types.js";
import type { DatabaseTransaction } from "../database/client.js";

export interface FeatureDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly defaultEnabled: boolean;
  readonly dependencies?: readonly string[];
  readonly requiredBotPermissions?: readonly PermissionResolvable[];
}

export interface CapabilityDefinition {
  readonly id: string;
  readonly description: string;
}

export interface DocumentationPage {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly summary: string;
  readonly body: string;
  readonly keywords?: readonly string[];
}

export interface ModuleManifest {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly icon: string;
  readonly defaultEnabled: boolean;
  readonly dependencies?: readonly string[];
  readonly features: readonly FeatureDefinition[];
  readonly config: readonly ConfigDefinition[];
  readonly capabilities: readonly CapabilityDefinition[];
  readonly docs: readonly DocumentationPage[];
}

export interface ModuleEventHandler<Name extends keyof ClientEvents = keyof ClientEvents> {
  readonly name: Name;
  readonly once?: boolean;
  execute(client: BotClient, ...args: ClientEvents[Name]): Promise<void> | void;
}

export interface BotModule {
  readonly manifest: ModuleManifest;
  readonly commands: readonly BotCommand[];
  readonly events?: readonly ModuleEventHandler[];
  authorizeCommand?(client: BotClient, interaction: import("../commands/command.js").BotCommandInteraction, nativePermission: bigint): Promise<boolean>;
  isConfigurationComponent?(action: string): boolean;
  featureForComponent?(action: string): string | undefined;
  handleComponent?(client: BotClient, interaction: RoutedComponentInteraction, action: string, parts: readonly string[]): Promise<void>;
  configurationView?(settings: import("../config/service.js").GuildConfigService, guildId: string, actorId: string): Promise<import("discord.js").InteractionUpdateOptions>;
  initialize?(client: BotClient): Promise<void> | void;
  shutdown?(): Promise<void> | void;
  resetGuild?(guildId: string, transaction: DatabaseTransaction): Promise<void>;
}
