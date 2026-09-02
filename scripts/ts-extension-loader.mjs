import { access } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (path.extname(specifier) || error?.code !== "ERR_MODULE_NOT_FOUND") {
      throw error;
    }

    if (specifier.startsWith(".")) {
      const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
      const candidate = path.resolve(path.dirname(parentPath), `${specifier}.ts`);
      await access(candidate);
      return nextResolve(pathToFileURL(candidate).href, context);
    }

    return nextResolve(`${specifier}.js`, context);
  }
}
