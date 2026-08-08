import { MessageFlags, type InteractionEditReplyOptions, type InteractionReplyOptions, type RepliableInteraction } from "discord.js";

export type SafeReplyOptions = Omit<InteractionReplyOptions, "ephemeral">;

export async function respond(interaction: RepliableInteraction, options: SafeReplyOptions, ephemeral = true): Promise<void> {
  const base = { ...options, allowedMentions: options.allowedMentions ?? { parse: [] as never[] } };
  if (interaction.deferred && !interaction.replied) {
    await interaction.editReply(base as InteractionEditReplyOptions);
  } else if (interaction.replied) {
    await interaction.followUp({ ...base, ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {}) });
  } else {
    await interaction.reply({ ...base, ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {}) });
  }
}
