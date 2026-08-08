import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../command.js";
import { moderation, requireGuildInteraction, requireTargetMember } from "../../../moderation/interactions/context.js";
import { replyWithCase } from "../../../moderation/interactions/replies.js";
import { safeUrl } from "../../../moderation/utils/validation.js";

export default {
  data: new SlashCommandBuilder().setName("warn").setDescription("Issue a formal warning to a member")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption((option) => option.setName("user").setDescription("Member to warn").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Reason for the warning").setMaxLength(1_000).setRequired(true))
    .addStringOption((option) => option.setName("evidence").setDescription("Optional message link or evidence URL")),
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const target = await requireTargetMember(interaction);
    const evidenceValue = interaction.options.getString("evidence");
    const evidence = evidenceValue ? safeUrl(evidenceValue) : undefined;
    const item = await moderation(client).moderation.warn({ guild, actor, target, idempotencyKey: interaction.id, reason: interaction.options.getString("reason", true), ...(evidence ? { source: { url: evidence } } : {}) });
    if (evidence) await moderation(client).cases.addEvidence({ caseId: item.id, guildId: guild.id, actorId: actor.id, type: "url", source: evidence });
    await replyWithCase(interaction, item);
  },
} satisfies BotCommand;
