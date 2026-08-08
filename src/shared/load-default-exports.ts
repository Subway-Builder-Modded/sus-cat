import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

interface DefaultExport<T> {
  readonly default?: T;
}

export async function loadDefaultExports<T>(directory: URL): Promise<T[]> {
  const files = await findModuleFiles(fileURLToPath(directory));
  const modules = await Promise.all(
    files.map((file) => import(pathToFileURL(file).href) as Promise<DefaultExport<T>>),
  );

  return modules.flatMap((module) => (module.default ? [module.default] : []));
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
