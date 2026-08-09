import { MessageFlags, type InteractionReplyOptions, type MessageComponentInteraction, type RepliableInteraction } from "discord.js";

export type SafeReplyOptions = Pick<InteractionReplyOptions, "allowedMentions" | "components" | "content" | "embeds">;

export async function deferEphemeral(interaction: RepliableInteraction): Promise<void> {
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
}

export async function updateComponent(interaction: MessageComponentInteraction, options: SafeReplyOptions): Promise<void> {
  if (interaction.deferred) await interaction.editReply(options);
  else await interaction.update(options);
}

export async function respond(interaction: RepliableInteraction, options: SafeReplyOptions, ephemeral = true): Promise<void> {
  const base: SafeReplyOptions = { ...options, allowedMentions: options.allowedMentions ?? { parse: [] } };
  if (interaction.deferred && !interaction.replied) {
    await interaction.editReply(base);
  } else if (interaction.replied) {
    await interaction.followUp({ ...base, ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {}) });
  } else {
    await interaction.reply({ ...base, ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {}) });
  }
}
