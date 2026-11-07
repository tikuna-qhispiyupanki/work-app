// Permet aux tests unitaires (Node) d'importer les fichiers TypeScript de l'application
// écrits sans extension (« ./pricing ») et avec l'alias « @/ » (= src/).
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('data:text/javascript,' + encodeURIComponent(`
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const SRC = ${JSON.stringify(pathToFileURL(new URL('../../src/', import.meta.url).pathname).href)};
export async function resolve(specifier, context, next) {
  let spec = specifier.startsWith('@/') ? SRC + specifier.slice(2) : specifier;
  if ((spec.startsWith('.') || spec.startsWith('file:')) && !/\\.[cm]?[jt]sx?$/.test(spec)) {
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      const url = new URL(spec + ext, context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
  }
  return next(spec, context);
}`));
