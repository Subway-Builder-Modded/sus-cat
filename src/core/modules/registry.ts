import type { BotModule, FeatureDefinition, ModuleManifest } from "./types.js";

export class ModuleRegistry {
  readonly #modules = new Map<string, BotModule>();

  register(module: BotModule): void {
    validateManifest(module.manifest);
    if (this.#modules.has(module.manifest.id)) throw new Error(`Duplicate module ID: ${module.manifest.id}`);
    this.#modules.set(module.manifest.id, module);
  }

  get(id: string): BotModule | undefined { return this.#modules.get(id); }
  require(id: string): BotModule {
    const module = this.get(id);
    if (!module) throw new Error(`Unknown module: ${id}`);
    return module;
  }
  all(): readonly BotModule[] { return [...this.#modules.values()]; }
  manifests(): readonly ModuleManifest[] { return this.all().map((module) => module.manifest); }
  validateDependencies(): void {
    for (const module of this.all()) for (const dependency of module.manifest.dependencies ?? []) if (!this.#modules.has(dependency)) throw new Error(`Unknown module dependency: ${module.manifest.id} -> ${dependency}`);
    const visiting = new Set<string>(), visited = new Set<string>();
    const visit = (id: string): void => {
      if (visiting.has(id)) throw new Error(`Cyclic module dependency: ${id}`);
      if (visited.has(id)) return;
      visiting.add(id);
      for (const dependency of this.require(id).manifest.dependencies ?? []) visit(dependency);
      visiting.delete(id);
      visited.add(id);
    };
    for (const module of this.all()) visit(module.manifest.id);
  }
}

export function validateManifest(manifest: ModuleManifest): void {
  if (!/^[a-z][a-z0-9-]*$/.test(manifest.id)) throw new Error(`Invalid module ID: ${manifest.id}`);
  const features = new Map<string, FeatureDefinition>();
  for (const feature of manifest.features) {
    if (features.has(feature.id)) throw new Error(`Duplicate feature ID: ${manifest.id}.${feature.id}`);
    features.set(feature.id, feature);
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error(`Cyclic feature dependency: ${manifest.id}.${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of features.get(id)?.dependencies ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of features.keys()) visit(id);
  for (const feature of manifest.features) {
    for (const dependency of feature.dependencies ?? []) {
      if (!features.has(dependency)) throw new Error(`Unknown feature dependency: ${manifest.id}.${feature.id} -> ${dependency}`);
      if (dependency === feature.id) throw new Error(`Feature cannot depend on itself: ${manifest.id}.${feature.id}`);
    }
  }
  const configKeys = new Set<string>();
  for (const definition of manifest.config) {
    if (configKeys.has(definition.key)) throw new Error(`Duplicate config key: ${manifest.id}.${definition.key}`);
    configKeys.add(definition.key);
    if (definition.requiredWhen && !features.has(definition.requiredWhen.featureId)) throw new Error(`Unknown requiredWhen feature: ${manifest.id}.${definition.key}`);
  }
}
