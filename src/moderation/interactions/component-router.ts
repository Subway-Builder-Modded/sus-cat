import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  type ButtonInteraction, type Interaction, type ModalSubmitInteraction, type StringSelectMenuInteraction,
} from "discord.js";

import type { BotClient } from "../../bot/bot-client.js";
import { logger } from "../../shared/logger.js";
import { toError } from "../../shared/to-error.js";
import { requireModerationModule } from "../moderation-module.js";
import { requireCapability } from "../permissions/capabilities.js";
import { buildCaseEmbed } from "../ui/case-embed.js";
import { buildHistoryDashboard } from "../ui/history-dashboard.js";
import { errorEmbed, successEmbed } from "../ui/responses.js";
import { publicErrorMessage } from "../ui/public-error.js";
import { buildSearchResults } from "../ui/search-results.js";
import { moderationColors } from "../ui/theme.js";
import { componentId, parseComponentId } from "../utils/custom-id.js";
import { MAX_TIMEOUT_MS, parseDuration } from "../utils/duration.js";
import { safeUrl, truncate, validateReason } from "../utils/validation.js";

export async function routeModerationComponent(client: BotClient, interaction: Interaction): Promise<void> {
  if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;
  const parsed = parseComponentId(interaction.customId);
  if (!parsed) return;
  try {
    if (!interaction.inCachedGuild()) throw new Error("This control can only be used in its original server.");
    if (interaction.isButton()) await routeButton(client, interaction, parsed.action, parsed.parts);
    else if (interaction.isStringSelectMenu()) await routeSelect(client, interaction, parsed.action, parsed.parts);
    else await routeModal(client, interaction, parsed.action, parsed.parts);
  } catch (error: unknown) {
    const normalized = toError(error);
    const errorId = `MOD-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    logger.error("Moderation component failed", { errorId, guildId: interaction.guildId, actorId: interaction.user.id, action: parsed.action, error: normalized.message });
    const response = { embeds: [errorEmbed(publicErrorMessage(error), errorId)], ephemeral: true, allowedMentions: { parse: [] as never[] } };
    if (interaction.replied || interaction.deferred) await interaction.followUp(response);
    else await interaction.reply(response);
  }
}

async function routeButton(client: BotClient, interaction: ButtonInteraction<"cached">, action: string, parts: string[]): Promise<void> {
  const module = requireModerationModule(client);
  if (action === "confirm" || action === "cancel") {
    const token = requiredPart(parts, 0);
    if (action === "cancel") {
      module.confirmations.cancel(token, interaction.user.id);
      await interaction.update({ embeds: [successEmbed("Cancelled", "No action was taken.")], components: [] });
      return;
    }
    const payload = module.confirmations.consume(token, interaction.user.id);
    if (payload.guildId !== interaction.guildId) throw new Error("This confirmation belongs to another server.");
    await interaction.deferUpdate();
    const actor = interaction.member;
    if (payload.type === "purge") {
      const channel = await interaction.guild.channels.fetch(payload.channelId);
      if (!channel || channel.type !== ChannelType.GuildText) throw new Error("The purge channel is no longer available.");
      const result = await module.channels.purge(channel, actor, payload);
      await interaction.editReply({ embeds: [successEmbed("Purge complete", `Deleted **${result.deleted}** of ${result.matched} matching messages.${result.tooOld ? ` ${result.tooOld} were too old for bulk deletion.` : ""}`)], components: [] });
    } else {
      const target = await interaction.guild.members.fetch(payload.targetId);
      const context = { guild: interaction.guild, actor, target, reason: payload.reason, idempotencyKey: payload.idempotencyKey };
      const item = payload.type === "ban"
        ? await module.moderation.ban(context, { deleteMessageSeconds: payload.deleteSeconds, ...(payload.durationMs ? { durationMs: payload.durationMs } : {}) })
        : await module.moderation.softban(context, payload.deleteSeconds);
      await interaction.editReply({ embeds: [buildCaseEmbed(item)], components: [] });
    }
    return;
  }

  const expectedActor = requiredPart(parts, 0);
  ensureActor(interaction.user.id, expectedActor);
  if (action === "search") {
    const results = module.searches.get(requiredPart(parts, 1), interaction.user.id, interaction.guildId);
    await interaction.update(buildSearchResults(results, interaction.user.id, requiredPart(parts, 1), Number(requiredPart(parts, 2))));
    return;
  }
  if (action === "history") {
    const targetId = requiredPart(parts, 1);
    const page = Number(requiredPart(parts, 2));
    const config = await module.configs.get(interaction.guildId);
    requireCapability(interaction.member, "moderation.view", config);
    const [user, member, summary, history] = await Promise.all([
      client.users.fetch(targetId), interaction.guild.members.fetch(targetId).catch(() => undefined),
      module.cases.summary(interaction.guildId, targetId), module.cases.history(interaction.guildId, targetId, page),
    ]);
    await interaction.update(buildHistoryDashboard(user, member, summary, history, interaction.user.id));
    return;
  }
  if (action === "quick") {
    await interaction.update(quickPanel(interaction.user.id, requiredPart(parts, 1)));
    return;
  }
  if (action.startsWith("quick_")) {
    await interaction.showModal(quickActionModal(action.slice(6), expectedActor, requiredPart(parts, 1)));
    return;
  }
  if (action.startsWith("msg_")) {
    const channelId = requiredPart(parts, 1);
    const messageId = requiredPart(parts, 2);
    if (action === "msg_evidence") {
      await interaction.showModal(messageEvidenceModal(expectedActor, channelId, messageId));
    } else {
      await interaction.showModal(messageActionModal(action.slice(4), expectedActor, channelId, messageId));
    }
    return;
  }
  if (action.startsWith("case_")) {
    const caseId = requiredPart(parts, 1);
    const item = await module.cases.getById(caseId);
    if (!item || item.guildId !== interaction.guildId) throw new Error("That case no longer exists in this server.");
    const config = await module.configs.get(interaction.guildId);
    requireCapability(interaction.member, "moderation.view", config);
    if (action === "case_evidence") {
      const evidence = await module.cases.listEvidence(caseId);
      const embed = new EmbedBuilder().setColor(moderationColors.info).setTitle(`Evidence • Case #${item.caseNumber}`).setDescription(evidence.map((entry, index) => `**${index + 1}. ${entry.type.toUpperCase()}** — ${truncate(entry.description ?? entry.source, 200)}\nAdded by <@${entry.addedById}> <t:${Math.floor(entry.createdAt.getTime() / 1_000)}:R>`).join("\n\n") || "No evidence has been added.");
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("case_evidence_add", expectedActor, caseId)).setLabel("Add Evidence").setStyle(ButtonStyle.Primary));
      await interaction.update({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
    } else if (action === "case_evidence_add") {
      requireCapability(interaction.member, "moderation.evidence.manage", config);
      await interaction.showModal(caseEvidenceModal(expectedActor, caseId));
    } else if (action === "case_note") {
      requireCapability(interaction.member, "moderation.note", config);
      await interaction.showModal(singleInputModal("modal_case_note", expectedActor, caseId, "Add Staff Note", "note", "Private note", TextInputStyle.Paragraph));
    } else if (action === "case_edit") {
      requireCapability(interaction.member, "moderation.case.edit", config);
      await interaction.showModal(singleInputModal("modal_case_edit", expectedActor, caseId, "Edit Case Reason", "reason", "New reason", TextInputStyle.Paragraph, item.reason));
    } else if (action === "case_reverse") {
      await interaction.showModal(singleInputModal("modal_case_reverse", expectedActor, caseId, "Reverse Punishment", "reason", "Reason for reversal", TextInputStyle.Paragraph));
    }
  }
}

async function routeSelect(client: BotClient, interaction: StringSelectMenuInteraction<"cached">, action: string, parts: string[]): Promise<void> {
  if (action !== "history_case") return;
  ensureActor(interaction.user.id, requiredPart(parts, 0));
  const module = requireModerationModule(client);
  const item = await module.cases.getById(requiredPart(interaction.values, 0));
  if (!item || item.guildId !== interaction.guildId) throw new Error("That case no longer exists.");
  requireCapability(interaction.member, "moderation.view", await module.configs.get(interaction.guildId));
  const [user, evidence] = await Promise.all([client.users.fetch(item.targetUserId).catch(() => undefined), module.cases.listEvidence(item.id)]);
  const { caseControls } = await import("../ui/case-controls.js");
  await interaction.update({ embeds: [buildCaseEmbed(item, user, evidence.length)], components: [caseControls(item, interaction.user.id)], allowedMentions: { parse: [] } });
}

async function routeModal(client: BotClient, interaction: ModalSubmitInteraction<"cached">, action: string, parts: string[]): Promise<void> {
  const module = requireModerationModule(client);
  const expectedActor = requiredPart(parts, 0);
  ensureActor(interaction.user.id, expectedActor);
  const actor = interaction.member;

  if (action.startsWith("modal_quick_")) {
    const operation = action.slice(12);
    const target = await interaction.guild.members.fetch(requiredPart(parts, 1));
    const reason = interaction.fields.getTextInputValue("reason");
    await interaction.deferReply({ ephemeral: true });
    const context = { guild: interaction.guild, actor, target, reason, idempotencyKey: interaction.id };
    if (operation === "warn") await interaction.editReply({ embeds: [buildCaseEmbed(await module.moderation.warn(context))] });
    else if (operation === "note") await interaction.editReply({ embeds: [buildCaseEmbed(await module.moderation.note(context))] });
    else if (operation === "timeout") await interaction.editReply({ embeds: [buildCaseEmbed(await module.moderation.timeout(context, parseDuration(interaction.fields.getTextInputValue("duration"), MAX_TIMEOUT_MS)))] });
    else if (operation === "kick") await interaction.editReply({ embeds: [buildCaseEmbed(await module.moderation.kick(context))] });
    else if (operation === "ban") {
      const durationText = optionalField(interaction, "duration");
      const durationMs = durationText ? parseDuration(durationText, 365 * 86_400_000) : undefined;
      const token = module.confirmations.create({ type: "ban", guildId: interaction.guildId, actorId: actor.id, targetId: target.id, reason: validateReason(reason), deleteSeconds: 0, ...(durationMs ? { durationMs } : {}), idempotencyKey: interaction.id });
      const { confirmationButtons } = await import("../ui/confirmation.js");
      const { confirmationEmbed } = await import("../ui/responses.js");
      await interaction.editReply({ embeds: [confirmationEmbed("Confirm Ban", `${target} will be banned.\n\n**Reason**\n${reason}`)], components: [confirmationButtons(token)] });
    }
    return;
  }

  if (action.startsWith("modal_msg_")) {
    const operation = action.slice(10);
    const channel = await interaction.guild.channels.fetch(requiredPart(parts, 1));
    if (!channel?.isTextBased() || channel.isDMBased()) throw new Error("The source channel is unavailable.");
    const message = await channel.messages.fetch(requiredPart(parts, 2)).catch(() => undefined);
    if (!message) throw new Error("The source message has already been deleted.");
    const config = await module.configs.get(interaction.guildId);
    requireCapability(actor, operation === "delete" ? "moderation.purge" : operation === "timeout" ? "moderation.timeout" : "moderation.warn", config);
    const reason = validateReason(interaction.fields.getTextInputValue("reason"));
    await interaction.deferReply({ ephemeral: true });
    let item;
    if (operation === "warn" || operation === "timeout") {
      const target = await interaction.guild.members.fetch(message.author.id);
      const context = { guild: interaction.guild, actor, target, reason, idempotencyKey: interaction.id, source: { channelId: channel.id, messageId: message.id, url: message.url } };
      item = operation === "warn" ? await module.moderation.warn(context) : await module.moderation.timeout(context, parseDuration(interaction.fields.getTextInputValue("duration"), MAX_TIMEOUT_MS));
      await module.cases.addEvidence({ caseId: item.id, guildId: interaction.guildId, actorId: actor.id, type: "message", source: message.url, description: "Source message reference", metadata: { channelId: channel.id, messageId: message.id, authorId: message.author.id, attachments: message.attachments.size } });
    }
    await message.delete();
    await module.cases.audit("message.deleted", interaction.guildId, actor.id, item?.id, message.author.id, { channelId: channel.id, messageId: message.id, combinedAction: operation });
    await interaction.editReply({ embeds: [item ? buildCaseEmbed(item) : successEmbed("Message deleted", `The message in <#${channel.id}> was deleted.`)] });
    return;
  }

  if (action === "modal_evidence_message") {
    const channel = await interaction.guild.channels.fetch(requiredPart(parts, 1));
    if (!channel?.isTextBased() || channel.isDMBased()) throw new Error("The source channel is unavailable.");
    const message = await channel.messages.fetch(requiredPart(parts, 2)).catch(() => undefined);
    if (!message) throw new Error("The source message is unavailable.");
    const item = await module.cases.getByNumber(interaction.guildId, Number(interaction.fields.getTextInputValue("case_number")));
    if (!item) throw new Error("That case does not exist.");
    requireCapability(actor, "moderation.evidence.manage", await module.configs.get(interaction.guildId));
    const description = optionalField(interaction, "description");
    await module.cases.addEvidence({ caseId: item.id, guildId: interaction.guildId, actorId: actor.id, type: "message", source: message.url, ...(description ? { description } : {}), metadata: { channelId: channel.id, messageId: message.id, authorId: message.author.id, attachments: message.attachments.size } });
    await interaction.reply({ embeds: [successEmbed("Evidence added", `The message was attached to case #${item.caseNumber}.`)], ephemeral: true });
    return;
  }

  const caseId = requiredPart(parts, 1);
  const item = await module.cases.getById(caseId);
  if (!item || item.guildId !== interaction.guildId) throw new Error("That case no longer exists.");
  const config = await module.configs.get(interaction.guildId);
  if (action === "modal_case_edit") {
    requireCapability(actor, "moderation.case.edit", config);
    const updated = await module.cases.edit(caseId, actor.id, { reason: validateReason(interaction.fields.getTextInputValue("reason")) });
    await interaction.reply({ embeds: [buildCaseEmbed(updated)], ephemeral: true });
  } else if (action === "modal_case_note") {
    requireCapability(actor, "moderation.note", config);
    await module.cases.addNote({ guildId: interaction.guildId, targetUserId: item.targetUserId, actorId: actor.id, caseId, content: validateReason(interaction.fields.getTextInputValue("note")) });
    await interaction.reply({ embeds: [successEmbed("Note added", `A private staff note was linked to case #${item.caseNumber}.`)], ephemeral: true });
  } else if (action === "modal_case_reverse") {
    const updated = await module.moderation.reverseCase(item, actor, interaction.fields.getTextInputValue("reason"));
    await interaction.reply({ embeds: [buildCaseEmbed(updated)], ephemeral: true });
  } else if (action === "modal_case_evidence") {
    requireCapability(actor, "moderation.evidence.manage", config);
    const type = interaction.fields.getTextInputValue("type").trim().toLowerCase();
    if (!["note", "url", "attachment"].includes(type)) throw new Error("Evidence type must be note, URL, or attachment.");
    const description = optionalField(interaction, "description");
    const sourceValue = interaction.fields.getTextInputValue("source");
    const source = type === "url" ? safeUrl(sourceValue) : sourceValue.trim();
    if (!source) throw new Error("Evidence cannot be blank.");
    await module.cases.addEvidence({ caseId, guildId: interaction.guildId, actorId: actor.id, type: type as "note" | "url" | "attachment", source, ...(description ? { description } : {}) });
    await interaction.reply({ embeds: [successEmbed("Evidence added", `Evidence was attached to case #${item.caseNumber}.`)], ephemeral: true });
  }
}

function quickPanel(actorId: string, targetId: string) {
  return { embeds: [new EmbedBuilder().setColor(moderationColors.info).setTitle("Quick Moderate").setDescription(`<@${targetId}> \`${targetId}\`\nChoose an action. Details will be collected before anything is applied.`)], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(componentId("quick_warn", actorId, targetId)).setLabel("Warn").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(componentId("quick_timeout", actorId, targetId)).setLabel("Timeout").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(componentId("quick_kick", actorId, targetId)).setLabel("Kick").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(componentId("quick_ban", actorId, targetId)).setLabel("Ban").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(componentId("quick_note", actorId, targetId)).setLabel("Note").setStyle(ButtonStyle.Secondary),
  )], allowedMentions: { parse: [] as never[] } };
}

function quickActionModal(operation: string, actorId: string, targetId: string): ModalBuilder {
  if (!["warn", "timeout", "kick", "ban", "note"].includes(operation)) throw new Error("Unknown moderation action.");
  const modal = new ModalBuilder().setCustomId(componentId(`modal_quick_${operation}`, actorId, targetId)).setTitle(`${operation[0]?.toUpperCase()}${operation.slice(1)} Member`)
    .addComponents(inputRow("reason", operation === "note" ? "Private note" : "Reason", TextInputStyle.Paragraph, true, 1_000));
  if (operation === "timeout") modal.addComponents(inputRow("duration", "Duration (for example 2h)", TextInputStyle.Short, true, 20));
  if (operation === "ban") modal.addComponents(inputRow("duration", "Temporary duration (optional)", TextInputStyle.Short, false, 20));
  return modal;
}

function messageActionModal(operation: string, actorId: string, channelId: string, messageId: string): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(componentId(`modal_msg_${operation}`, actorId, channelId, messageId)).setTitle(operation === "delete" ? "Confirm Message Deletion" : `Delete + ${operation}`)
    .addComponents(inputRow("reason", "Reason", TextInputStyle.Paragraph, true, 1_000));
  if (operation === "timeout") modal.addComponents(inputRow("duration", "Timeout duration", TextInputStyle.Short, true, 20));
  return modal;
}

function messageEvidenceModal(actorId: string, channelId: string, messageId: string): ModalBuilder {
  return new ModalBuilder().setCustomId(componentId("modal_evidence_message", actorId, channelId, messageId)).setTitle("Add Message as Evidence").addComponents(
    inputRow("case_number", "Case number", TextInputStyle.Short, true, 10), inputRow("description", "Description (optional)", TextInputStyle.Paragraph, false, 500),
  );
}

function caseEvidenceModal(actorId: string, caseId: string): ModalBuilder {
  return new ModalBuilder().setCustomId(componentId("modal_case_evidence", actorId, caseId)).setTitle("Add Case Evidence").addComponents(
    inputRow("type", "Type: note, url, or attachment", TextInputStyle.Short, true, 20), inputRow("source", "Evidence source or text", TextInputStyle.Paragraph, true, 1_000), inputRow("description", "Description (optional)", TextInputStyle.Paragraph, false, 500),
  );
}

function singleInputModal(action: string, actorId: string, caseId: string, title: string, fieldId: string, label: string, style: TextInputStyle, value?: string): ModalBuilder {
  const input = new TextInputBuilder().setCustomId(fieldId).setLabel(label).setStyle(style).setRequired(true).setMaxLength(1_000);
  if (value) input.setValue(truncate(value, 1_000));
  return new ModalBuilder().setCustomId(componentId(action, actorId, caseId)).setTitle(title).addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
}

function inputRow(id: string, label: string, style: TextInputStyle, required: boolean, maxLength: number) {
  return new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setMaxLength(maxLength));
}

function optionalField(interaction: ModalSubmitInteraction, id: string): string | undefined {
  try { return interaction.fields.getTextInputValue(id).trim() || undefined; } catch { return undefined; }
}

function requiredPart(parts: string[], index: number): string {
  const part = parts[index];
  if (!part) throw new Error("This component identifier is invalid.");
  return part;
}

function ensureActor(actual: string, expected: string): void {
  if (expected !== "any" && actual !== expected) throw new Error("Only the moderator who opened this panel can use it.");
}
