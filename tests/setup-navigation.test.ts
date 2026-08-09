import { describe, expect, it, vi } from "vitest";

import { ModuleRegistry } from "../src/core/modules/registry.js";
import { handleSetupComponent } from "../src/core/setup/handler.js";
import { featureSelectionView, moduleSelectionView, setupConfigurationView, setupFieldEditor } from "../src/core/setup/views.js";
import { parseComponentId } from "../src/core/interactions/custom-id.js";

const module = { manifest: { id: "sample", name: "Sample", description: "Sample module", version: "1", icon: "🧩", defaultEnabled: false, features: [{ id: "one", name: "One", description: "One", defaultEnabled: true }, { id: "two", name: "Two", description: "Two", defaultEnabled: true }], config: [{ key: "scope", label: "Scope", description: "Audit scope", type: "enum", defaultValue: "moderation", category: "audit", featureId: "one", requiredWhen: { featureId: "one", enabled: true }, choices: [{ name: "Moderation", value: "moderation" }, { name: "Full", value: "full" }] }, { key: "threshold", label: "Threshold", description: "Optional threshold", type: "integer", defaultValue: 25, category: "advanced", featureId: "one", min: 1, max: 100 }], capabilities: [], docs: [] }, commands: [] } as const;
const registry = new ModuleRegistry(); registry.register(module);

describe("setup selection and navigation", () => {
  it.each([true, false])("shows an explicit Continue button when every feature enabled is %s", async (enabled) => {
    const settings = { isFeatureEnabled: async () => enabled } as never;
    const view = await featureSelectionView(settings, registry, "guild", "sample", "actor");
    const ids = view.components.flatMap((row) => row.components.map((component) => component.toJSON().custom_id)).filter(Boolean);
    expect(ids.some((id) => typeof id === "string" && parseComponentId(id)?.action === "continue_features")).toBe(true);
    expect(ids.some((id) => typeof id === "string" && parseComponentId(id)?.action === "back_features")).toBe(true);
  });
  it("keeps module selection and advancement as separate component actions", async () => {
    const settings = { isModuleEnabled: async () => true } as never;
    const view = await moduleSelectionView(settings, registry, "guild", "actor");
    const actions = view.components.flatMap((row) => row.components.map((component) => componentAction(component.toJSON().custom_id)));
    expect(actions).toContain("modules");
    expect(actions).toContain("continue_modules");
    expect(actions).toContain("back_admin");
  });
  it("lists every available setting and marks required fields", async () => {
    const settings = { getModuleConfig: async () => ({ scope: "moderation", threshold: 25 }), isConfigAvailable: async () => true, isConfigRequired: async (_guild: string, _module: string, key: string) => key === "scope" } as never;
    const view = await setupConfigurationView(settings, registry, "guild", "sample", "actor");
    const actions = view.components.flatMap((row) => row.components.map((component) => componentAction(component.toJSON().custom_id)));
    expect(actions).toContain("config_field");
    const options = view.components[0]?.components[0]?.toJSON().options;
    expect(options).toEqual(expect.arrayContaining([expect.objectContaining({ label: "Scope*", value: "scope" }), expect.objectContaining({ label: "Threshold", value: "threshold" })]));
    expect(view.embeds[0]?.toJSON().description).toContain("**Scope***");
    expect(view.components.length).toBeLessThanOrEqual(5);
  });
  it("provides the type-appropriate editor from the full setup picker", async () => {
    const settings = { getModuleConfig: async () => ({ scope: "moderation", threshold: 25 }), requireConfigAvailable: async () => undefined, isConfigRequired: async () => true } as never;
    const editor = await setupFieldEditor(settings, registry, "guild", "sample", "scope", "actor");
    expect("view" in editor && componentAction(editor.view.components?.[0]?.components?.[0]?.toJSON().custom_id)).toBe("config_value");
    const modalEditor = await setupFieldEditor(settings, registry, "guild", "sample", "threshold", "actor");
    expect("modal" in modalEditor && parseComponentId(modalEditor.modal.toJSON().custom_id)?.action).toBe("config_modal");
  });
  it("hides setup fields owned by disabled features", async () => {
    const settings = { getModuleConfig: async () => ({ scope: "moderation" }), isConfigAvailable: async () => false, isConfigRequired: async () => false } as never;
    const view = await setupConfigurationView(settings, registry, "guild", "sample", "actor");
    const actions = view.components.flatMap((row) => row.components.map((component) => componentAction(component.toJSON().custom_id)));
    expect(actions).not.toContain("config_field");
    expect(actions).toContain("continue_config");
  });
  it("skips the configuration embed when a module has no available settings", async () => {
    const emptyModule = { manifest: { ...module.manifest, id: "empty", name: "Empty", config: [] }, commands: [] } as const;
    const nextModule = { manifest: { ...module.manifest, id: "next", name: "Next" }, commands: [] } as const;
    const setupRegistry = new ModuleRegistry();
    setupRegistry.register(emptyModule);
    setupRegistry.register(nextModule);
    const update = vi.fn();
    const settings = {
      isModuleEnabled: vi.fn(async () => true),
      isFeatureEnabled: vi.fn(async () => true),
    };
    const guild = { id: "guild", ownerId: "actor" };
    const interaction = {
      guild,
      guildId: guild.id,
      member: { id: "actor", guild },
      user: { id: "actor" },
      inCachedGuild: () => true,
      isMessageComponent: () => true,
      update,
    };

    await handleSetupComponent({ platform: { settings, modules: setupRegistry } } as never, interaction as never, "continue_features", ["actor", "empty"]);

    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0]?.[0].embeds[0].toJSON().title).toBe("🧩 Next Features");
    expect(settings.isConfigAvailable).toBeUndefined();
  });
});

function componentAction(customId: string | undefined): string | undefined {
  return customId ? parseComponentId(customId)?.action : undefined;
}
