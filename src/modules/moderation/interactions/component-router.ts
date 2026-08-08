import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags, ModalBuilder, PermissionFlagsBits, TextInputBuilder, TextInputStyle, type ButtonInteraction, type ModalSubmitInteraction, type StringSelectMenuInteraction, type TextChannel } from "discord.js";

import type { BotClient } from "../../../core/bot/bot-client.js";
import type { RoutedComponentInteraction } from "../../../core/interactions/types.js";
import { warningEmbed } from "../../../core/ui/embeds.js";
import { buildCasePayload } from "../commands/case.js";
import { purgeSummary } from "../commands/purge.js";
import { buildUserPayload, filterActions } from "../commands/user.js";
import type { EvidenceResult } from "../domain/types.js";
import { requireModerationModule } from "../moderation-module.js";
import { requireModerationAccess } from "../permissions/authorization.js";
import { buildActionCard } from "../ui/actions/action-card.js";
import { evidenceResultMenu, evidenceView, timelineView } from "../ui/cases/case-view.js";
import { successEmbed } from "../ui/responses.js";
import { componentId } from "../utils/custom-id.js";
import { handleConfigButton, handleConfigModal, handleConfigSelect } from "./config-router.js";

export async function handleModerationComponent(client: BotClient, interaction: RoutedComponentInteraction, action: string, parts: readonly string[]): Promise<void> {
  if (!interaction.inCachedGuild()) throw new Error("This control can only be used in its original server.");
  if (interaction.isButton()) await routeButton(client, interaction, action, parts);
  else if (interaction.isStringSelectMenu()) await routeSelect(client, interaction, action, parts);
  else if (interaction.isModalSubmit()) await routeModal(client, interaction, action, parts);
}

async function routeButton(client: BotClient, interaction: ButtonInteraction<"cached">, action: string, parts: readonly string[]): Promise<void> {
  const module = requireModerationModule(client);
  if (action === "confirm" || action === "cancel") {
    const token = required(parts, 0);
    if (action === "cancel") { module.confirmations.cancel(token, interaction.user.id); await interaction.update({ embeds: [successEmbed("Cancelled", "No action was taken.")], components: [] }); return; }
    const payload = module.confirmations.consume(token, interaction.user.id); if (payload.guildId !== interaction.guildId) throw new Error("This confirmation belongs to another server.");
    await interaction.deferUpdate();
    if (payload.type === "purge") {
      await requireModerationAccess(client, interaction.member, PermissionFlagsBits.ManageMessages);
      if (!await client.platform.settings.isFeatureEnabled(interaction.guildId, "moderation", "purge")) throw new Error("Purge was disabled before confirmation.");
      const fetched = await Promise.all(payload.channelIds.map((id) => interaction.guild.channels.fetch(id))), channels = fetched.filter((channel): channel is TextChannel => channel?.type === ChannelType.GuildText);
      await interaction.editReply({ embeds: [successEmbed("Purge complete", purgeSummary(await module.channels.purge(channels, interaction.member, payload)))], components: [] }); return;
    }
    await requireModerationAccess(client, interaction.member, PermissionFlagsBits.BanMembers);
    if (!await client.platform.settings.isFeatureEnabled(interaction.guildId, "moderation", "bans")) throw new Error("Bans were disabled before confirmation.");
    const target = await interaction.guild.members.fetch(payload.targetId), outcome = await module.moderation.ban({ guild: interaction.guild, actor: interaction.member, target, reason: payload.reason, silent: payload.silent, idempotencyKey: payload.idempotencyKey }, payload.deleteSeconds);
    if (payload.evidence && !payload.silent) {
      if (!await client.platform.settings.isFeatureEnabled(interaction.guildId, "moderation", "evidence")) throw new Error("The ban succeeded, but Evidence was disabled before attachment.");
      if (outcome.case) await module.cases.addEvidence({ caseId: outcome.case.id, ...(outcome.entry ? { caseEntryId: outcome.entry.id } : {}), guildId: interaction.guildId, actorId: interaction.user.id, evidence: payload.evidence, result: "ban", idempotencyKey: `${payload.idempotencyKey}:evidence` });
    }
    await interaction.editReply({ embeds: [buildActionCard({ action: "ban", actor: interaction.member, target, reason: payload.reason, ...(outcome.case ? { case: outcome.case } : {}), ...(outcome.entry ? { entry: outcome.entry } : {}), ...(payload.evidence && !payload.silent ? { evidence: payload.evidence } : {}) })], components: [] }); return;
  }

  ensureActor(interaction.user.id, required(parts, 0));
  if (await handleConfigButton(client, interaction, action, parts)) return;
  if (action === "case_back") { await interaction.update({ embeds: [successEmbed("Closed", "The case panel was closed.")], components: [] }); return; }
  if (action === "case_number") { await requireModerationAccess(client, interaction.member, PermissionFlagsBits.ViewAuditLog); await interaction.update(await buildCasePayload(client, interaction.guildId, Number(required(parts, 1)), interaction.user.id)); return; }
  if (action === "case_timeline") {
    await requireModerationAccess(client, interaction.member, PermissionFlagsBits.ViewAuditLog); const page = await module.cases.timeline(required(parts, 1), Number(required(parts, 2)));
    if (!page || page.case.guildId !== interaction.guildId) throw new Error("That case no longer exists."); await interaction.update(timelineView({ ...page, actorId: interaction.user.id })); return;
  }
  if (action === "case_evidence" || action === "case_evidence_page") {
    await requireModerationAccess(client, interaction.member, PermissionFlagsBits.ViewAuditLog); const caseId = required(parts, 1), item = await module.cases.getById(caseId); if (!item || item.guildId !== interaction.guildId) throw new Error("That case no longer exists.");
    const evidence = await module.cases.listEvidence(caseId), index = action === "case_evidence_page" ? Number(required(parts, 2)) : 0; await interaction.update(evidenceView({ case: item, items: evidence, index: Math.max(0, Math.min(index, Math.max(0, evidence.length - 1))), actorId: interaction.user.id })); return;
  }
  if (action === "case_evidence_add") { await requireModerationAccess(client, interaction.member, PermissionFlagsBits.ViewAuditLog); await interaction.showModal(evidenceModal("modal_evidence_add", interaction.user.id, required(parts, 1), "new", "Add Evidence")); return; }
  if (action === "case_evidence_edit") {
    await requireModerationAccess(client, interaction.member, PermissionFlagsBits.ViewAuditLog); const evidence = (await module.cases.listEvidence(required(parts, 1))).find((item) => item.id === required(parts, 2)); if (!evidence) throw new Error("That evidence item no longer exists.");
    await interaction.showModal(evidenceModal("modal_evidence_edit", interaction.user.id, required(parts, 1), evidence.id, "Edit Evidence", evidence.evidence, evidence.description ?? undefined)); return;
  }
  if (action === "case_evidence_delete") {
    await requireModerationAccess(client, interaction.member, PermissionFlagsBits.ViewAuditLog); const caseId = required(parts, 1), evidenceId = required(parts, 2);
    await interaction.update({ embeds: [warningEmbed("Delete evidence?", "This permanently removes the item. The deletion remains audit logged.")], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("case_evidence_delete_confirm", interaction.user.id, caseId, evidenceId)).setLabel("Delete Evidence").setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId(componentId("case_evidence", interaction.user.id, caseId, "1")).setLabel("Cancel").setStyle(ButtonStyle.Secondary))] }); return;
  }
  if (action === "case_evidence_delete_confirm") {
    await requireModerationAccess(client, interaction.member, PermissionFlagsBits.ViewAuditLog); await module.cases.deleteEvidence(interaction.guildId, required(parts, 2), interaction.user.id);
    const item = await module.cases.getById(required(parts, 1)); if (!item) throw new Error("That case no longer exists."); await interaction.update(evidenceView({ case: item, items: await module.cases.listEvidence(item.id), index: 0, actorId: interaction.user.id })); return;
  }
  if (action === "user_view") { await requireModerationAccess(client, interaction.member, PermissionFlagsBits.ViewAuditLog); await interaction.update(await buildUserPayload(client, interaction.guildId, required(parts, 1), interaction.user.id)); return; }
  if (action === "user_filter") {
    await requireModerationAccess(client, interaction.member, PermissionFlagsBits.ViewAuditLog); const targetId = required(parts, 1), userCase = await module.cases.getByUser(interaction.guildId, targetId); if (!userCase) throw new Error("That user has no case.");
    const timeline = await module.cases.timeline(userCase.id, Number(required(parts, 3)), 5, filterActions(required(parts, 2))); if (!timeline) throw new Error("That user has no case."); await interaction.update(timelineView({ ...timeline, actorId: interaction.user.id }));
  }
}

async function routeSelect(client: BotClient, interaction: StringSelectMenuInteraction<"cached">, action: string, parts: readonly string[]): Promise<void> {
  ensureActor(interaction.user.id, required(parts, 0)); if (await handleConfigSelect(client, interaction, action)) return; if (action !== "case_evidence_result") return;
  await requireModerationAccess(client, interaction.member, PermissionFlagsBits.ViewAuditLog); const result = interaction.values[0] as EvidenceResult; if (!["none", "warn", "timeout", "kick", "ban", "unban", "untimeout"].includes(result)) throw new Error("That evidence result is invalid.");
  const module = requireModerationModule(client), caseId = required(parts, 1); await module.cases.editEvidence(interaction.guildId, required(parts, 2), interaction.user.id, { result }); const item = await module.cases.getById(caseId); if (!item) throw new Error("That case no longer exists.");
  const evidence = await module.cases.listEvidence(caseId); await interaction.update(evidenceView({ case: item, items: evidence, index: Math.max(0, evidence.findIndex((entry) => entry.id === required(parts, 2))), actorId: interaction.user.id }));
}

async function routeModal(client: BotClient, interaction: ModalSubmitInteraction<"cached">, action: string, parts: readonly string[]): Promise<void> {
  ensureActor(interaction.user.id, required(parts, 0)); if (await handleConfigModal(client, interaction, action, parts)) return; const module = requireModerationModule(client);
  if (action === "case_reset_modal") {
    await requireModerationAccess(client, interaction.member, PermissionFlagsBits.ManageGuild, true); if (interaction.fields.getTextInputValue("confirmation") !== "RESET CASES") throw new Error("Confirmation did not match. Nothing was reset.");
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }); await module.cases.resetGuildCases(interaction.guildId); await interaction.editReply({ embeds: [successEmbed("Cases reset", "Cases, entries, evidence, custom types, and numbering were removed. Setup and module configuration remain unchanged.")] }); return;
  }
  if (action === "modal_message_evidence") {
    await requireModerationAccess(client, interaction.member, PermissionFlagsBits.ViewAuditLog); await interaction.deferReply({ flags: MessageFlags.Ephemeral }); const targetId = required(parts, 1), channel = await interaction.guild.channels.fetch(required(parts, 2)); if (!channel?.isTextBased() || channel.isDMBased()) throw new Error("The source channel is unavailable.");
    const message = await channel.messages.fetch(required(parts, 3)), userCase = await module.cases.getByUser(interaction.guildId, targetId); if (!userCase) throw new Error("This user has no case yet. Create one or perform a non-silent case-producing action first."); const description = optionalField(interaction, "description");
    const created = await module.cases.addEvidence({ caseId: userCase.id, guildId: interaction.guildId, actorId: interaction.user.id, evidence: `${message.content || "*No text content*"}\n\nSource: ${message.url}`.slice(0, 4000), ...(description ? { description } : {}), result: "none", idempotencyKey: interaction.id, metadata: { channelId: message.channelId, messageId: message.id, authorId: message.author.id, attachments: [...message.attachments.values()].map((item) => item.url) } });
    await interaction.editReply({ embeds: [successEmbed("Evidence added", `The message was added to case #${userCase.caseNumber}. Choose its result below.`)], components: [evidenceResultMenu(interaction.user.id, userCase.id, created.id)] }); return;
  }
  if (action === "modal_evidence_add" || action === "modal_evidence_edit") {
    await requireModerationAccess(client, interaction.member, PermissionFlagsBits.ViewAuditLog); await interaction.deferReply({ flags: MessageFlags.Ephemeral }); const caseId = required(parts, 1), evidenceId = required(parts, 2), evidence = interaction.fields.getTextInputValue("evidence").trim(), description = optionalField(interaction, "description"); if (!evidence) throw new Error("Evidence cannot be blank.");
    const item = action === "modal_evidence_add" ? await module.cases.addEvidence({ caseId, guildId: interaction.guildId, actorId: interaction.user.id, evidence, ...(description ? { description } : {}), result: "none", idempotencyKey: interaction.id }) : await module.cases.editEvidence(interaction.guildId, evidenceId, interaction.user.id, { evidence, description: description ?? null });
    await interaction.editReply({ embeds: [successEmbed(action === "modal_evidence_add" ? "Evidence added" : "Evidence updated", "Choose the result below, or leave it as None.")], components: [evidenceResultMenu(interaction.user.id, caseId, item.id)] });
  }
}

function evidenceModal(action: string, actorId: string, caseId: string, evidenceId: string, title: string, evidence?: string, description?: string): ModalBuilder {
  const evidenceInput = new TextInputBuilder().setCustomId("evidence").setLabel("Evidence").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000), descriptionInput = new TextInputBuilder().setCustomId("description").setLabel("Description (optional)").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000);
  if (evidence) evidenceInput.setValue(evidence.slice(0, 4000)); if (description) descriptionInput.setValue(description.slice(0, 1000)); return new ModalBuilder().setCustomId(componentId(action, actorId, caseId, evidenceId)).setTitle(title).addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(evidenceInput), new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput));
}
function optionalField(interaction: ModalSubmitInteraction, id: string): string | undefined { try { return interaction.fields.getTextInputValue(id).trim() || undefined; } catch { return undefined; } }
function required(parts: readonly string[], index: number): string { const value = parts[index]; if (!value) throw new Error("This control is incomplete or stale."); return value; }
function ensureActor(actual: string, expected: string): void { if (actual !== expected) throw new Error("Only the moderator who opened this panel can use it."); }
