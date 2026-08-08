import { Events } from "discord.js";

import { dispatchCommand } from "../../commands/dispatcher.js";
import { routeComponent } from "../../interactions/router.js";
import { defineEvent } from "../bot-event.js";

export default defineEvent({
  name: Events.InteractionCreate,
  async execute(client, interaction) {
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      await (command?.autocomplete ? command.autocomplete(client, interaction) : interaction.respond([]));
    } else if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) await dispatchCommand(client, interaction);
    else await routeComponent(client, interaction);
  },
});
