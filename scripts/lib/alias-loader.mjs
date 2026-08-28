// Minimal Node ESM loader that rewrites the "@/..." path alias (declared in jsconfig.json for
// Next.js's own bundler) to a real file:// URL under src/, so plain `node` scripts can import
// application code (models, lib helpers) the same way the app does, without duplicating logic.
// Also probes common extensions (.js/.jsx), since Next's bundler resolves extensionless
// specifiers but plain Node ESM does not.
//
// Not used directly — registered by profile-finance-pages.mjs via node:module's register().

import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(THIS_DIR, "..", "..", "src");

const CANDIDATE_EXTENSIONS = ["", ".js", ".jsx", ".mjs"];

function resolveUnderSrc(specifier) {
  const rest = specifier.slice(2); // strip "@/"
  const basePath = path.join(SRC_DIR, rest);
  for (const ext of CANDIDATE_EXTENSIONS) {
    const candidate = basePath + ext;
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  // Nothing matched on disk — fall back to the bare rewrite so Node's own error message
  // (rather than a silent wrong guess) tells you what's missing.
  return pathToFileURL(basePath).href;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(resolveUnderSrc(specifier), context);
  }
  return nextResolve(specifier, context);
}
