import type { BotModule, DocumentationPage } from "../../../core/modules/types.js";

export interface IndexedDocument extends DocumentationPage { readonly moduleId: string; readonly score?: number; }

export function buildDocumentationIndex(modules: readonly BotModule[]): IndexedDocument[] {
  return modules.flatMap((module) => {
    const manifest = module.manifest;
    return [
    { moduleId: manifest.id, id: "module", title: manifest.name, category: "Modules", summary: manifest.description, body: `${manifest.description}\n\nFeatures: ${manifest.features.map((feature) => feature.name).join(", ") || "None"}.`, keywords: [manifest.id, "module"] },
    ...module.commands.map((command) => { const json = command.data.toJSON(); return { moduleId: manifest.id, id: `command-${json.name.toLowerCase().replaceAll(" ", "-")}`, title: `/${json.name}`, category: "Commands", summary: "description" in json ? json.description : `${manifest.name} context command`, body: `Owned by ${manifest.name}.${command.requirements.featureId ? ` Requires feature: ${command.requirements.featureId}.` : ""}`, keywords: [json.name, "command", manifest.id] }; }),
    ...manifest.features.map((feature) => ({ moduleId: manifest.id, id: `feature-${feature.id}`, title: feature.name, category: manifest.name, summary: feature.description, body: `${feature.description}${feature.dependencies?.length ? ` Depends on: ${feature.dependencies.join(", ")}.` : ""}`, keywords: [feature.id, manifest.id, "feature"] })),
    ...manifest.config.map((field) => ({ moduleId: manifest.id, id: `config-${field.key}`, title: field.label, category: "Configuration", summary: field.description, body: `${field.description} Type: ${field.type}.${field.required || field.requiredWhen ? " This field may be required." : ""}`, keywords: [field.key, manifest.id, field.type] })),
    ...manifest.docs.map((page) => ({ ...page, moduleId: manifest.id })),
  ];
  });
}

export function searchDocumentation(index: readonly IndexedDocument[], query: string, limit = 10): IndexedDocument[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return index.map((document) => {
    const title = document.title.toLowerCase(), haystack = `${document.title} ${document.summary} ${document.body} ${(document.keywords ?? []).join(" ")}`.toLowerCase();
    const score = terms.reduce((total, term) => total + (title.includes(term) ? 5 : 0) + (haystack.split(term).length - 1), 0);
    return { ...document, score };
  }).filter((document) => (document.score ?? 0) > 0).sort((left, right) => (right.score ?? 0) - (left.score ?? 0)).slice(0, limit);
}
