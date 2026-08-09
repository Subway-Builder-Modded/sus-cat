import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function loadDefaultExports(directory: URL): Promise<unknown[]> {
  const files = await findModuleFiles(fileURLToPath(directory));
  const modules: unknown[] = await Promise.all(files.map((file) => import(pathToFileURL(file).href)));

  return modules.flatMap((module) => hasDefaultExport(module) ? [module.default] : []);
}

function hasDefaultExport(value: unknown): value is { readonly default: unknown } {
  return typeof value === "object" && value !== null && "default" in value;
}

async function findModuleFiles(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error: unknown) {
    if (isMissingDirectoryError(error)) return [];
    throw error;
  }

  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return findModuleFiles(path);
      return isRuntimeModule(entry.name) ? [path] : [];
    }),
  );

  return nestedFiles.flat().sort();
}

function isRuntimeModule(fileName: string): boolean {
  return !fileName.endsWith(".d.ts") && [".js", ".ts"].includes(extname(fileName));
}

function isMissingDirectoryError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
