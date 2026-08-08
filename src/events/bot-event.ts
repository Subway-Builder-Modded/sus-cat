import type { ClientEvents } from "discord.js";

import type { BotClient } from "../bot/bot-client.js";

export interface BotEvent {
  readonly name: keyof ClientEvents;
  readonly once?: boolean;
  execute(client: BotClient, ...args: unknown[]): Promise<void> | void;
}

type TypedBotEvent<Name extends keyof ClientEvents> = Omit<BotEvent, "name" | "execute"> & {
  readonly name: Name;
  execute(client: BotClient, ...args: ClientEvents[Name]): Promise<void> | void;
};

export function defineEvent<Name extends keyof ClientEvents>(event: TypedBotEvent<Name>): BotEvent {
  return event as unknown as BotEvent;
}
