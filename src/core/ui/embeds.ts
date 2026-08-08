import { EmbedBuilder } from "discord.js";

import { ui } from "./theme.js";

export function infoEmbed(title: string, description: string): EmbedBuilder { return new EmbedBuilder().setColor(ui.colors.primary).setTitle(title).setDescription(description); }
export function successEmbed(title: string, description: string): EmbedBuilder { return new EmbedBuilder().setColor(ui.colors.success).setTitle(`${ui.icons.success} ${title}`).setDescription(description); }
export function warningEmbed(title: string, description: string): EmbedBuilder { return new EmbedBuilder().setColor(ui.colors.warning).setTitle(`${ui.icons.warning} ${title}`).setDescription(description); }
export function errorEmbed(title: string, description: string): EmbedBuilder { return new EmbedBuilder().setColor(ui.colors.danger).setTitle(`${ui.icons.error} ${title}`).setDescription(description); }
