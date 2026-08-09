import { describe, expect, it } from "vitest";

import { configurationHome, fieldEditor, moduleConfigurationView, settingsPicker } from "../src/core/config/views.js";
import { parseComponentId } from "../src/core/interactions/custom-id.js";
import { ModuleRegistry } from "../src/core/modules/registry.js";
import { documentationModule } from "../src/modules/documentation/index.js";
import { moderationModule } from "../src/modules/moderation/index.js";

const registry = new ModuleRegistry();
registry.register(documentationModule);
registry.register(moderationModule);

const settings = {
  getModuleConfig: async () => ({ auditScope: "moderation", moderatorRoleIds: [] }),
  isConfigAvailable: async () => true,
  isConfigRequired: async () => false,
  isFeatureEnabled: async () => true,
  isModuleEnabled: async () => true,
} as never;

describe("configuration views", () => {
  it("uses the same module controls for Documentation and Moderation", async () => {
    const documentation = await moduleConfigurationView(settings, registry, "guild", "documentation", "actor");
    const moderation = await moduleConfigurationView(settings, registry, "guild", "moderation", "actor");
    expect(labels(documentation)).toEqual(["Disable Module", "Features", "Settings", "Back", "Reset Module"]);
    expect(labels(moderation)).toEqual(labels(documentation));
    expect(moderation.embeds[0]?.toJSON().title).toBe("🛡️ Moderation");
  });

  it("shows every available moderation setting in one dropdown without Advanced", async () => {
    const view = await settingsPicker(settings, registry, "guild", "moderation", "actor");
    const options = view.components[0]?.components[0]?.toJSON().options ?? [];
    expect(view.embeds[0]?.toJSON().title).toBe("🛡️ Moderation --> Settings");
    expect(options.map((option) => option.label)).toContain("Custom Case Types");
    expect(options.map((option) => option.label)).not.toContain("Advanced");
    expect(view.components).toHaveLength(2);
  });

  it("uses icon-prefixed breadcrumb titles for setting editors", async () => {
    const view = await fieldEditor(settings, registry, "guild", "moderation", "auditScope", "actor");
    expect(view.embeds[0]?.toJSON().title).toBe("🛡️ Moderation --> Settings --> Log Scope");
    expect(actions(view)).toContain("save_field");
    expect(actions(view)).toContain("settings");
  });

  it("does not expose the Recent Changes menu", async () => {
    const view = await configurationHome(settings, registry, "guild", "actor");
    expect(labels(view)).not.toContain("Recent Changes");
    expect(actions(view)).not.toContain("audit");
  });
});

function labels(view: { components: readonly { components: readonly { toJSON(): { label?: string } }[] }[] }): string[] {
  return view.components.flatMap((row) => row.components.map((component) => component.toJSON().label).filter((label): label is string => Boolean(label)));
}

function actions(view: { components: readonly { components: readonly { toJSON(): { custom_id?: string } }[] }[] }): string[] {
  return view.components.flatMap((row) => row.components.map((component) => parseComponentId(component.toJSON().custom_id ?? "")?.action).filter((action): action is string => Boolean(action)));
}
