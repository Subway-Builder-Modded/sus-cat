import { ChannelType, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../../../core/commands/command.js";
import { moderation, requireGuildInteraction } from "../interactions/context.js";
import { replyPrivately } from "../interactions/replies.js";
import { requireCapability } from "../permissions/capabilities.js";
import { label } from "../ui/case-embed.js";
import { successEmbed } from "../ui/responses.js";
import { moderationColors } from "../ui/theme.js";
import { safeUrl, truncate } from "../utils/validation.js";

export default {
  data: new SlashCommandBuilder().setName("mod").setDescription("Moderation dashboards and configuration")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((command) => command.setName("dashboard").setDescription("Open the moderation dashboard"))
    .addSubcommand((command) => command.setName("active").setDescription("View active temporary punishments"))
    .addSubcommand((command) => command.setName("config").setDescription("View or update moderation configuration")
      .addStringOption((option) => option.setName("setting").setDescription("Setting to update; omit to view").addChoices(
        { name: "Mod log channel", value: "mod-log" }, { name: "Private audit channel", value: "audit-log" },
        { name: "User DMs", value: "dms" }, { name: "Staff role", value: "staff-role" }, { name: "Purge threshold", value: "purge-threshold" },
        { name: "Rules URL", value: "rules-url" }, { name: "Staff notes", value: "notes" },
        { name: "Temporary bans", value: "temporary-bans" }, { name: "Persistent case buttons", value: "case-buttons" },
      ))
      .addChannelOption((option) => option.setName("channel").setDescription("Channel value").addChannelTypes(ChannelType.GuildText))
      .addBooleanOption((option) => option.setName("enabled").setDescription("Boolean value"))
      .addRoleOption((option) => option.setName("role").setDescription("Staff role to grant/remove"))
      .addStringOption((option) => option.setName("value").setDescription("Text value for the selected setting").setMaxLength(500))
      .addIntegerOption((option) => option.setName("threshold").setDescription("Large purge confirmation threshold").setMinValue(1).setMaxValue(100))),
  requirements: { moduleId: "moderation", featureId: "case-management", capability: "moderation.view", guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const module = moderation(client);
    let config = await module.configs.get(guild.id);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "active") {
      requireCapability(actor, "moderation.view", config);
      const active = await module.cases.active(guild.id);
      const body = active.map((item) => `**#${item.caseNumber}** ${label(item.action)} • <@${item.targetUserId}>${item.expiresAt ? ` • expires <t:${Math.floor(item.expiresAt.getTime() / 1_000)}:R>` : ""}`).join("\n") || "No active temporary punishments.";
      await replyPrivately(interaction, { embeds: [successEmbed("Active punishments", body)] });
      return;
    }

    if (subcommand === "dashboard") {
      requireCapability(actor, "moderation.view", config);
      const recent = await module.cases.recent(guild.id, 8);
      const today = recent.filter((item) => item.createdAt.getTime() >= new Date().setUTCHours(0, 0, 0, 0));
      const active = await module.cases.active(guild.id);
      const embed = new EmbedBuilder().setColor(moderationColors.info).setTitle("🛡️ Moderation Dashboard")
        .addFields(
          { name: "Today", value: `${today.filter((item) => item.action === "warn").length} warnings • ${today.filter((item) => item.action === "timeout").length} timeouts • ${today.filter((item) => item.action === "ban").length} bans` },
          { name: "Active", value: `${active.length} temporary punishment${active.length === 1 ? "" : "s"}` },
          { name: "Recent cases", value: recent.map((item) => `**#${item.caseNumber}** ${item.action.toUpperCase()} • <@${item.targetUserId}> • ${truncate(item.reason, 60)}`).join("\n") || "No cases yet." },
          { name: "Configuration", value: `Mod log: ${config.modLogChannelId ? `<#${config.modLogChannelId}>` : "Not set"}\nPrivate audit: ${config.auditLogChannelId ? `<#${config.auditLogChannelId}>` : "Not set"}\nUser DMs: ${config.dmUsers ? "Enabled" : "Disabled"}` },
        ).setTimestamp();
      await replyPrivately(interaction, { embeds: [embed] });
      return;
    }

    requireCapability(actor, "moderation.config", config);
    const setting = interaction.options.getString("setting");
    if (setting === "mod-log" || setting === "audit-log") {
      const channel = interaction.options.getChannel("channel", true);
      config = await module.configs.update(guild.id, actor.id, setting === "mod-log" ? { modLogChannelId: channel.id } : { auditLogChannelId: channel.id });
    } else if (setting === "dms") {
      config = await module.configs.update(guild.id, actor.id, { dmUsers: interaction.options.getBoolean("enabled", true) });
    } else if (setting === "staff-role") {
      const role = interaction.options.getRole("role", true);
      const roles = config.staffRoleIds.includes(role.id) ? config.staffRoleIds.filter((id) => id !== role.id) : [...config.staffRoleIds, role.id];
      config = await module.configs.update(guild.id, actor.id, { staffRoleIds: roles });
    } else if (setting === "purge-threshold") {
      config = await module.configs.update(guild.id, actor.id, { purgeConfirmationThreshold: interaction.options.getInteger("threshold", true) });
    } else if (setting === "rules-url") {
      config = await module.configs.update(guild.id, actor.id, { rulesUrl: safeUrl(interaction.options.getString("value", true)) });
    } else if (setting === "notes" || setting === "temporary-bans" || setting === "case-buttons") {
      const enabled = interaction.options.getBoolean("enabled", true);
      config = await module.configs.update(guild.id, actor.id, setting === "notes" ? { notesEnabled: enabled } : setting === "temporary-bans" ? { temporaryBansEnabled: enabled } : { caseButtonsEnabled: enabled });
    }
    await replyPrivately(interaction, { embeds: [successEmbed(setting ? "Configuration updated" : "Moderation configuration", `Mod log: ${config.modLogChannelId ? `<#${config.modLogChannelId}>` : "Not set"}\nPrivate audit: ${config.auditLogChannelId ? `<#${config.auditLogChannelId}>` : "Not set"}\nUser DMs: ${config.dmUsers ? "Enabled" : "Disabled"}\nStaff notes: ${config.notesEnabled ? "Enabled" : "Disabled"}\nTemporary bans: ${config.temporaryBansEnabled ? "Enabled" : "Disabled"}\nPersistent buttons: ${config.caseButtonsEnabled ? "Enabled" : "Disabled"}\nRules: ${config.rulesUrl ?? "Not set"}\nStaff roles: ${config.staffRoleIds.length ? config.staffRoleIds.map((id) => `<@&${id}>`).join(", ") : "None"}\nPurge confirmation: ${config.purgeConfirmationThreshold}+ messages`) ] });
  },
} satisfies BotCommand;
