import { ActionRowBuilder, ChannelType, MessageFlags, ModalBuilder, PermissionFlagsBits, PermissionsBitField, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

import type { BotClient } from "../../../core/bot/bot-client.js";
import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction } from "../interactions/context.js";
import { replyPrivately } from "../interactions/replies.js";
import { requireModerationAccess } from "../permissions/authorization.js";
import { caseOverview } from "../ui/cases/case-view.js";
import { buildActionCard } from "../ui/actions/action-card.js";
import { publishAuditLog } from "../ui/actions/audit-log-publisher.js";
import { parseDuration, MAX_TIMEOUT_MS } from "../utils/duration.js";
import { componentId } from "../utils/custom-id.js";

const actionChoices = [
  { name: "None — record only", value: "none" }, { name: "Warning", value: "warn" }, { name: "Timeout", value: "timeout" },
  { name: "Kick", value: "kick" }, { name: "Ban", value: "ban" }, { name: "Create private case channel", value: "create_channel" },
] as const;

export default {
  data: new SlashCommandBuilder().setName("case").setDescription("View and manage user moderation cases")
    .addSubcommand((command) => command.setName("view").setDescription("View one user case").addIntegerOption((option) => option.setName("number").setDescription("Case number").setRequired(true).setMinValue(1)))
    .addSubcommand((command) => command.setName("create").setDescription("Create or append to a user's case")
      .addUserOption((option) => option.setName("user").setDescription("Target user").setRequired(true))
      .addStringOption((option) => option.setName("type").setDescription("Custom case type; defaults to None").setAutocomplete(true))
      .addStringOption((option) => option.setName("action").setDescription("Optional Discord action").addChoices(...actionChoices))
      .addStringOption((option) => option.setName("reason").setDescription("Reason or details").setMaxLength(1_000))
      .addStringOption((option) => option.setName("duration").setDescription("Required for Timeout, for example 2h")))
    .addSubcommand((command) => command.setName("reset").setDescription("Permanently reset all moderation cases and custom types")),
  requirements: { moduleId: "moderation", featureId: "cases", nativeUserPermission: PermissionFlagsBits.ViewAuditLog, guildOnly: true, setupRequired: true, acknowledgement: "immediate" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) return;
    const { guild, actor } = requireGuildInteraction(interaction), subcommand = interaction.options.getSubcommand();
    if (subcommand === "reset") {
      await requireModerationAccess(client, actor, PermissionFlagsBits.ManageGuild, true);
      await interaction.showModal(new ModalBuilder().setCustomId(componentId("case_reset_modal", actor.id)).setTitle("Reset all moderation cases").addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("confirmation").setLabel("Type RESET CASES to confirm").setStyle(TextInputStyle.Short).setRequired(true))));
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (subcommand === "view") {
      await replyPrivately(interaction, await buildCasePayload(client, guild.id, interaction.options.getInteger("number", true), actor.id));
      return;
    }
    const targetUser = interaction.options.getUser("user", true), action = interaction.options.getString("action") ?? "none", reason = interaction.options.getString("reason")?.trim();
    const typeValue = interaction.options.getString("type"), customType = typeValue ? await moderation(client).cases.resolveCustomType(guild.id, typeValue) : undefined;
    if (typeValue && !customType) throw new Error("That custom case type is stale or no longer exists.");
    if (["warn", "timeout", "kick", "ban"].includes(action) && !reason) throw new Error("A reason is required for that action.");
    let result;
    const member = await guild.members.fetch(targetUser.id).catch(() => undefined);
    if (action === "none") result = await moderation(client).cases.append({ guildId: guild.id, targetUserId: targetUser.id, actorId: actor.id, action: "manual", ...(reason ? { reason } : {}), ...(customType ? { customType } : {}), idempotencyKey: interaction.id });
    else if (action === "create_channel") {
      await requireModerationAccess(client, actor, PermissionFlagsBits.ManageChannels);
      result = await moderation(client).cases.append({ guildId: guild.id, targetUserId: targetUser.id, actorId: actor.id, action: "create_channel", ...(reason ? { reason } : {}), ...(customType ? { customType } : {}), idempotencyKey: interaction.id });
      const config = await moderation(client).configs.get(guild.id), botAdminRoleIds = await client.platform.settings.botAdminRoleIds(guild.id);
      const allowedRoles = [...new Set([...config.moderatorRoleIds, ...botAdminRoleIds])];
      const channel = await guild.channels.create({ name: `case-${result.case.caseNumber}-${sanitize(targetUser.username)}`, type: ChannelType.GuildText, ...(config.caseCategoryId ? { parent: config.caseCategoryId } : {}), permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: targetUser.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        ...allowedRoles.map((id) => ({ id, allow: new PermissionsBitField([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]) })),
        { id: client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] },
      ], reason: `Private moderation case #${result.case.caseNumber}` });
      await moderation(client).cases.updateEntryMetadata(guild.id, result.entry.id, { channelId: channel.id });
      await publishAuditLog(moderation(client).configs, guild, { action: "create_channel", actor, target: targetUser, ...(reason ? { reason } : {}), case: result.case, entry: result.entry, result: `${channel}` });
    } else {
      if (!member) throw new Error("That action requires a user who is currently in the server.");
      const permission = action === "ban" ? PermissionFlagsBits.BanMembers : action === "kick" ? PermissionFlagsBits.KickMembers : PermissionFlagsBits.ModerateMembers;
      await requireModerationAccess(client, actor, permission);
      const context = { guild, actor, target: member, reason: reason!, idempotencyKey: interaction.id, ...(customType ? { customType } : {}) };
      const outcome = action === "warn" ? await moderation(client).moderation.warn(context) : action === "timeout" ? await moderation(client).moderation.timeout(context, parseDuration(interaction.options.getString("duration") ?? "", MAX_TIMEOUT_MS)) : action === "kick" ? await moderation(client).moderation.kick(context) : await moderation(client).moderation.ban(context);
      await replyPrivately(interaction, { embeds: [buildActionCard({ action: outcome.action, actor, target: targetUser, ...(reason ? { reason } : {}), ...(outcome.case ? { case: outcome.case } : {}), ...(outcome.entry ? { entry: outcome.entry } : {}) })] });
      return;
    }
    await replyPrivately(interaction, await buildCasePayload(client, guild.id, result.case.caseNumber, actor.id));
  },
  async autocomplete(client, interaction) {
    if (!interaction.guildId || await client.platform.settings.setupStatus(interaction.guildId) !== "configured" || !await client.platform.settings.isFeatureEnabled(interaction.guildId, "moderation", "cases")) { await interaction.respond([]); return; }
    const focused = interaction.options.getFocused(true);
    await interaction.respond(focused.name === "type" ? await moderation(client).cases.autocompleteTypes(interaction.guildId, String(focused.value)) : []);
  },
} satisfies BotCommand;

export async function buildCasePayload(client: BotClient, guildId: string, caseNumber: number, actorId: string) {
  const item = await moderation(client).cases.getByNumber(guildId, caseNumber);
  if (!item) throw new Error("That moderation case does not exist.");
  const [user, summary, timeline, adjacent] = await Promise.all([client.users.fetch(item.targetUserId).catch(() => undefined), moderation(client).cases.summary(guildId, item.targetUserId), moderation(client).cases.timeline(item.id, 1, 1), moderation(client).cases.adjacent(guildId, caseNumber)]);
  return caseOverview({ case: item, ...(user ? { user } : {}), summary, ...(timeline?.entries[0] ? { latest: timeline.entries[0] } : {}), actorId, ...(adjacent.previous ? { previousNumber: adjacent.previous.caseNumber } : {}), ...(adjacent.next ? { nextNumber: adjacent.next.caseNumber } : {}) });
}

function sanitize(value: string): string { return value.toLocaleLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 60) || "user"; }
