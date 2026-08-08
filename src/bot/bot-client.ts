import { Client, Collection } from "discord.js";

import type { BotCommand } from "../commands/command.js";
import type { ModerationModule } from "../moderation/moderation-module.js";

export class BotClient extends Client {
  readonly commands = new Collection<string, BotCommand>();
  moderation?: ModerationModule;
}
