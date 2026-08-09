import { ActionRowBuilder, ModalBuilder, PermissionFlagsBits, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

import type { BotCommand } from "../../../core/commands/command.js";
import { deferEphemeral } from "../../../core/interactions/response.js";
import { moderation, requireGuildInteraction } from "../interactions/context.js";
import { replyPrivately } from "../interactions/replies.js";
import { hasModerationAccess, requireModerationAccess } from "../permissions/authorization.js";
import { buildActionCard } from "../ui/actions/action-card.js";
import { componentId } from "../utils/custom-id.js";
import { buildCasePayload } from "../interactions/case-view-controller.js";
import { caseActionChoices, caseActionFeature, caseActionPermission, parseCaseCreateAction, performCaseAction } from "./case-action.js";

export default {
  data: new SlashCommandBuilder().setName("case").setDescription("View and manage user moderation cases")
    .addSubcommand((command) => command.setName("view").setDescription("View one user case").addIntegerOption((option) => option.setName("number").setDescription("Case number").setRequired(true).setMinValue(1)))
    .addSubcommand((command) => command.setName("create").setDescription("Create or append to a user's case")
      .addUserOption((option) => option.setName("user").setDescription("Target user").setRequired(true))
      .addStringOption((option) => option.setName("type").setDescription("Custom case type; defaults to None").setAutocomplete(true))
      .addStringOption((option) => option.setName("action").setDescription("Optional Discord action").addChoices(...caseActionChoices))
      .addStringOption((option) => option.setName("reason").setDescription("Reason or details").setMaxLength(1_000))
      .addStringOption((option) => option.setName("duration").setDescription("Required for Timeout, for example 2h")))
    .addSubcommand((command) => command.setName("reset").setDescription("Permanently reset all moderation cases and custom types")),
  requirements: { moduleId: "moderation", featureId: "cases", guildOnly: true, setupRequired: true, acknowledgement: "immediate" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) return;
    const { guild, actor } = requireGuildInteraction(interaction), subcommand = interaction.options.getSubcommand();
    if (subcommand === "reset") {
      await requireModerationAccess(client, actor, PermissionFlagsBits.ManageGuild, true);
      await interaction.showModal(new ModalBuilder().setCustomId(componentId("case_reset_modal", actor.id)).setTitle("Reset all moderation cases").addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("confirmation").setLabel("Type RESET CASES to confirm").setStyle(TextInputStyle.Short).setRequired(true))));
      return;
    }
    await deferEphemeral(interaction);
    if (subcommand === "view") {
      await requireModerationAccess(client, actor, PermissionFlagsBits.ViewAuditLog);
      await replyPrivately(interaction, await buildCasePayload(client, guild.id, interaction.options.getInteger("number", true), actor.id));
      return;
    }
    const targetUser = interaction.options.getUser("user", true), action = parseCaseCreateAction(interaction.options.getString("action") ?? "none"), reason = interaction.options.getString("reason")?.trim();
    if (action === "none") await requireModerationAccess(client, actor, PermissionFlagsBits.ViewAuditLog);
    else if (action === "create_channel") {
      await requireModerationAccess(client, actor, PermissionFlagsBits.ManageChannels);
      if (!interaction.appPermissions?.has(PermissionFlagsBits.ManageChannels)) throw new Error("I need Manage Channels to create a private case channel.");
    } else {
      const featureId = caseActionFeature(action);
      if (!await client.platform.settings.isFeatureEnabled(guild.id, "moderation", featureId)) throw new Error(`${client.modules.require("moderation").manifest.features.find((feature) => feature.id === featureId)?.name ?? featureId} is disabled in this server.`);
      const permission = caseActionPermission(action);
      if (action !== "warn" && !interaction.appPermissions?.has(permission)) throw new Error("I am missing the Discord permission required for that action.");
      await requireModerationAccess(client, actor, permission);
    }
    const typeValue = interaction.options.getString("type"), customType = typeValue ? await moderation(client).caseTypes.resolve(guild.id, typeValue) : undefined;
    if (typeValue && !customType) throw new Error("That custom case type is stale or no longer exists.");
    if (["warn", "timeout", "kick", "ban"].includes(action) && !reason) throw new Error("A reason is required for that action.");
    let result;
    const member = await guild.members.fetch(targetUser.id).catch(() => undefined);
    if (action === "none") result = await moderation(client).cases.append({ guildId: guild.id, targetUserId: targetUser.id, actorId: actor.id, action: "manual", ...(reason ? { reason } : {}), ...(customType ? { customType } : {}), idempotencyKey: interaction.id });
    else if (action === "create_channel") {
      result = await moderation(client).caseChannels.create({ guild, actor, target: targetUser, idempotencyKey: interaction.id, ...(reason ? { reason } : {}), ...(customType ? { customType } : {}) });
    } else {
      if (!member) throw new Error("That action requires a user who is currently in the server.");
      if (!reason) throw new Error("A reason is required for that action.");
      const context = { guild, actor, target: member, reason, idempotencyKey: interaction.id, ...(customType ? { customType } : {}) };
      const outcome = await performCaseAction(client, action, context, interaction.options.getString("duration"));
      await replyPrivately(interaction, { embeds: [buildActionCard({ action: outcome.action, actor, target: targetUser, ...(reason ? { reason } : {}), ...(outcome.case ? { case: outcome.case } : {}), ...(outcome.entry ? { entry: outcome.entry } : {}) })] });
      return;
    }
    await replyPrivately(interaction, await buildCasePayload(client, guild.id, result.case.caseNumber, actor.id));
  },
  async autocomplete(client, interaction) {
    if (!interaction.inCachedGuild() || await client.platform.settings.setupStatus(interaction.guildId) !== "configured" || !await client.platform.settings.isFeatureEnabled(interaction.guildId, "moderation", "cases") || !await hasModerationAccess(client, interaction.member, PermissionFlagsBits.ViewAuditLog)) { await interaction.respond([]); return; }
    const focused = interaction.options.getFocused(true);
    await interaction.respond(focused.name === "type" ? await moderation(client).caseTypes.autocomplete(interaction.guildId, String(focused.value)) : []);
  },
} satisfies BotCommand;
