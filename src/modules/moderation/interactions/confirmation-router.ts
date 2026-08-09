import { ChannelType, PermissionFlagsBits, type ButtonInteraction, type TextChannel } from "discord.js";

import type { BotClient } from "../../../core/bot/bot-client.js";
import { respond, updateComponent } from "../../../core/interactions/response.js";
import { requireModerationModule } from "../moderation-module.js";
import { requireModerationAccess } from "../permissions/authorization.js";
import { buildActionCard } from "../ui/actions/action-card.js";
import { purgeSummary } from "../ui/purge-summary.js";
import { successEmbed } from "../ui/responses.js";
import { attachActionEvidence, requireActionEvidenceEnabled } from "./action-evidence.js";

export async function handleConfirmationButton(client: BotClient, interaction: ButtonInteraction<"cached">, action: string, token: string): Promise<boolean> {
  if (action !== "confirm" && action !== "cancel") return false;
  const module = requireModerationModule(client);
  if (action === "cancel") {
    module.confirmations.cancel(token, interaction.user.id);
    await updateComponent(interaction, { embeds: [successEmbed("Cancelled", "No action was taken.")], components: [] });
    return true;
  }

  const payload = module.confirmations.consume(token, interaction.user.id);
  if (payload.guildId !== interaction.guildId) throw new Error("This confirmation belongs to another server.");
  if (payload.type === "purge") {
    await requireModerationAccess(client, interaction.member, PermissionFlagsBits.ManageMessages);
    if (!await client.platform.settings.isFeatureEnabled(interaction.guildId, "moderation", "purge")) throw new Error("Purge was disabled before confirmation.");
    if (!interaction.appPermissions?.has(PermissionFlagsBits.ManageMessages)) throw new Error("I need Manage Messages to complete this purge.");
    const fetched = await Promise.all(payload.channelIds.map((id) => interaction.guild.channels.fetch(id)));
    const channels = fetched.filter((channel): channel is TextChannel => channel?.type === ChannelType.GuildText);
    const result = await module.purges.execute(channels, interaction.member, payload, payload.idempotencyKey);
    await respond(interaction, { embeds: [successEmbed("Purge complete", purgeSummary(result))], components: [] });
    return true;
  }

  await requireModerationAccess(client, interaction.member, PermissionFlagsBits.BanMembers);
  if (!await client.platform.settings.isFeatureEnabled(interaction.guildId, "moderation", "bans")) throw new Error("Bans were disabled before confirmation.");
  if (!interaction.appPermissions?.has(PermissionFlagsBits.BanMembers)) throw new Error("I need Ban Members to complete this ban.");
  await requireActionEvidenceEnabled(client, interaction.guildId, payload.evidence, payload.silent);
  const target = await interaction.guild.members.fetch(payload.targetId);
  const outcome = await module.moderation.ban({ guild: interaction.guild, actor: interaction.member, target, reason: payload.reason, silent: payload.silent, idempotencyKey: payload.idempotencyKey }, payload.deleteSeconds);
  const isEvidenceAttached = await attachActionEvidence(client, { guildId: interaction.guildId, actorId: interaction.user.id, interactionId: payload.idempotencyKey, ...(payload.evidence ? { evidence: payload.evidence } : {}), outcome, result: "ban", silent: payload.silent });
  await respond(interaction, { embeds: [buildActionCard({ action: "ban", actor: interaction.member, target, reason: payload.reason, ...(outcome.case ? { case: outcome.case } : {}), ...(outcome.entry ? { entry: outcome.entry } : {}), ...(isEvidenceAttached && payload.evidence ? { evidence: payload.evidence } : {}) })], components: [] });
  return true;
}
