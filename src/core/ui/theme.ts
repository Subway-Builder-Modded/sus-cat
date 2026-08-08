export const ui = {
  colors: { primary: 0x5865f2, success: 0x57f287, warning: 0xfee75c, danger: 0xed4245, neutral: 0x2b2d31 },
  icons: { enabled: "🟢", disabled: "⚫", success: "✅", warning: "⚠️", error: "❌" },
} as const;

export function statusLabel(enabled: boolean): string { return enabled ? `${ui.icons.enabled} Enabled` : `${ui.icons.disabled} Disabled`; }
export function channelLabel(value: unknown): string { return typeof value === "string" && value ? `<#${value}>` : "Not configured"; }
export function roleListLabel(value: unknown): string { return Array.isArray(value) && value.length ? value.map((id) => `<@&${String(id)}>`).join(", ") : "Not configured"; }
