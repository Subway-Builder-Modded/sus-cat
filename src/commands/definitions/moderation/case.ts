import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../../command.js";
import type { ModerationAction, ModerationCaseStatus } from "../../../moderation/domain/types.js";
import { moderation, requireGuildInteraction } from "../../../moderation/interactions/context.js";
import { replyPrivately } from "../../../moderation/interactions/replies.js";
import { requireCapability } from "../../../moderation/permissions/capabilities.js";
import { buildCaseEmbed } from "../../../moderation/ui/case-embed.js";
import { caseControls } from "../../../moderation/ui/case-controls.js";
import { validateReason } from "../../../moderation/utils/validation.js";
import { buildSearchResults } from "../../../moderation/ui/search-results.js";

const actions = ["warn", "note", "timeout", "untimeout", "kick", "ban", "unban", "softban", "nick", "manual", "automated"] as const;
const statuses = ["pending", "active", "expired", "reversed", "voided", "superseded", "failed"] as const;

export default {
  data: new SlashCommandBuilder().setName("case").setDescription("View and manage moderation cases")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((command) => command.setName("view").setDescription("View one case").addIntegerOption((option) => option.setName("number").setDescription("Case number").setRequired(true).setMinValue(1)))
    .addSubcommand((command) => command.setName("create").setDescription("Create a manual staff case")
      .addUserOption((option) => option.setName("user").setDescription("User").setRequired(true))
      .addStringOption((option) => option.setName("reason").setDescription("Case reason").setRequired(true).setMaxLength(1_000))
      .addStringOption((option) => option.setName("internal-note").setDescription("Optional private context").setMaxLength(1_000)))
    .addSubcommand((command) => command.setName("edit").setDescription("Edit a case with revision history")
      .addIntegerOption((option) => option.setName("number").setDescription("Case number").setRequired(true).setMinValue(1))
      .addStringOption((option) => option.setName("reason").setDescription("Updated reason").setMaxLength(1_000))
      .addStringOption((option) => option.setName("internal-note").setDescription("Updated private note").setMaxLength(1_000)))
    .addSubcommand((command) => command.setName("void").setDescription("Void a case without deleting it")
      .addIntegerOption((option) => option.setName("number").setDescription("Case number").setRequired(true).setMinValue(1))
      .addStringOption((option) => option.setName("reason").setDescription("Why this case is being voided").setRequired(true).setMaxLength(1_000)))
    .addSubcommand((command) => command.setName("search").setDescription("Search recent cases")
      .addUserOption((option) => option.setName("member").setDescription("Target member"))
      .addUserOption((option) => option.setName("moderator").setDescription("Acting moderator"))
      .addStringOption((option) => option.setName("action").setDescription("Action type").addChoices(...actions.map((value) => ({ name: value, value }))))
      .addStringOption((option) => option.setName("status").setDescription("Case status").addChoices(...statuses.map((value) => ({ name: value, value }))))
      .addStringOption((option) => option.setName("after").setDescription("Created after date (YYYY-MM-DD)"))
      .addStringOption((option) => option.setName("before").setDescription("Created before date (YYYY-MM-DD)"))),
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const module = moderation(client);
    const config = await module.configs.get(guild.id);
    requireCapability(actor, "moderation.view", config);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") {
      requireCapability(actor, "moderation.case.edit", config);
      const target = interaction.options.getUser("user", true);
      const internalNote = interaction.options.getString("internal-note");
      const pending = await module.cases.create({ guildId: guild.id, targetUserId: target.id, actorId: actor.id, action: "manual", reason: validateReason(interaction.options.getString("reason", true)), idempotencyKey: interaction.id, ...(internalNote ? { internalNote: validateReason(internalNote) } : {}) });
      const item = pending.status === "pending" ? await module.cases.transition(pending.id, "active", actor.id) : pending;
      await replyPrivately(interaction, { embeds: [buildCaseEmbed(item, target)] });
      return;
    }

    if (subcommand === "search") {
      const after = parseDate(interaction.options.getString("after"), "after");
      const before = parseDate(interaction.options.getString("before"), "before");
      const filters = {
        targetUserId: interaction.options.getUser("member")?.id,
        actorId: interaction.options.getUser("moderator")?.id,
        action: interaction.options.getString("action") as ModerationAction | null,
        status: interaction.options.getString("status") as ModerationCaseStatus | null,
        ...(after ? { after } : {}), ...(before ? { before } : {}),
      };
      const results = await module.cases.search(guild.id, Object.fromEntries(Object.entries(filters).filter(([, value]) => value != null)), 100);
      const token = module.searches.create(actor.id, guild.id, results);
      await replyPrivately(interaction, buildSearchResults(results, actor.id, token));
      return;
    }

    const item = await module.cases.getByNumber(guild.id, interaction.options.getInteger("number", true));
    if (!item) throw new Error("That moderation case does not exist.");
    if (subcommand === "view") {
      const [target, evidence] = await Promise.all([client.users.fetch(item.targetUserId).catch(() => undefined), module.cases.listEvidence(item.id)]);
      await replyPrivately(interaction, { embeds: [buildCaseEmbed(item, target, evidence.length)], components: [caseControls(item, actor.id)] });
    } else if (subcommand === "edit") {
      requireCapability(actor, "moderation.case.edit", config);
      const reasonValue = interaction.options.getString("reason");
      const noteValue = interaction.options.getString("internal-note");
      if (!reasonValue && !noteValue) throw new Error("Provide a reason or internal note to update.");
      const updated = await module.cases.edit(item.id, actor.id, { ...(reasonValue ? { reason: validateReason(reasonValue) } : {}), ...(noteValue ? { internalNote: validateReason(noteValue) } : {}) });
      await replyPrivately(interaction, { embeds: [buildCaseEmbed(updated)] });
    } else {
      requireCapability(actor, "moderation.case.void", config);
      const reason = validateReason(interaction.options.getString("reason", true));
      const updated = await module.cases.transition(item.id, "voided", actor.id, { reason });
      await replyPrivately(interaction, { embeds: [buildCaseEmbed(updated)] });
    }
  },
} satisfies BotCommand;

function parseDate(value: string | null, label: string): Date | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must use YYYY-MM-DD.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} is not a valid date.`);
  return date;
}
