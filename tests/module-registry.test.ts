import { describe, expect, it } from "vitest";

import { ModuleRegistry } from "../src/core/modules/registry.js";
import type { BotModule, ModuleManifest } from "../src/core/modules/types.js";

const manifest = (id: string, features: ModuleManifest["features"] = []): ModuleManifest => ({ id, name: id, description: id, version: "1", icon: "🧩", defaultEnabled: false, features, config: [], capabilities: [], docs: [] });
const module = (value: ModuleManifest): BotModule => ({ manifest: value, commands: [] });

describe("module registry", () => {
  it("registers stable module and feature identities", () => {
    const registry = new ModuleRegistry();
    registry.register(module(manifest("example", [{ id: "base", name: "Base", description: "base", defaultEnabled: true }, { id: "dependent", name: "Dependent", description: "dependent", defaultEnabled: true, dependencies: ["base"] }])));
    expect(registry.require("example").manifest.features).toHaveLength(2);
  });

  it("rejects duplicate modules, duplicate features, and missing dependencies", () => {
    const registry = new ModuleRegistry();
    registry.register(module(manifest("example")));
    expect(() => registry.register(module(manifest("example")))).toThrow("Duplicate module ID");
    expect(() => new ModuleRegistry().register(module(manifest("bad", [{ id: "same", name: "A", description: "", defaultEnabled: true }, { id: "same", name: "B", description: "", defaultEnabled: true }])))).toThrow("Duplicate feature ID");
    expect(() => new ModuleRegistry().register(module(manifest("bad", [{ id: "child", name: "Child", description: "", defaultEnabled: true, dependencies: ["missing"] }])))).toThrow("Unknown feature dependency");
    expect(() => new ModuleRegistry().register(module(manifest("bad", [{ id: "a", name: "A", description: "", defaultEnabled: true, dependencies: ["b"] }, { id: "b", name: "B", description: "", defaultEnabled: true, dependencies: ["a"] }])))).toThrow("Cyclic feature dependency");
  });

  it("validates custom configuration page identities and feature ownership", () => {
    const view = () => ({ embeds: [], components: [] });
    const value = manifest("example", [{ id: "base", name: "Base", description: "base", defaultEnabled: true }]);
    const registry = new ModuleRegistry();
    expect(() => registry.register({ ...module(value), configurationPages: [{ id: "custom", label: "Custom", description: "Custom", featureId: "missing", view }] })).toThrow("Unknown configuration page feature");
    expect(() => new ModuleRegistry().register({ ...module(value), configurationPages: [{ id: "custom", label: "Custom", description: "Custom", view }, { id: "custom", label: "Duplicate", description: "Duplicate", view }] })).toThrow("Duplicate configuration option");
  });
});
