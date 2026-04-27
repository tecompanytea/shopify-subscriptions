/**
 * Server-side locale bundle.
 *
 * On Vercel (and other serverless hosts) `i18next-fs-backend` reading
 * `public/locales/{{lng}}/{{ns}}.json` at request time fails — Vercel's
 * Node File Tracer can't statically resolve the dynamic path, so the
 * locale files aren't shipped into the function bundle and the read
 * ENOENTs. Use Vite's `import.meta.glob` to inline every locale JSON
 * at build time instead, then expose them as an i18next backend.
 */

import resourcesToBackend from 'i18next-resources-to-backend';

const localeModules = import.meta.glob<{default: Record<string, unknown>}>(
  '../../public/locales/*/*.json',
  {eager: true},
);

type Resources = Record<string, Record<string, Record<string, unknown>>>;

const resources: Resources = {};
for (const [path, mod] of Object.entries(localeModules)) {
  const match = path.match(/\/locales\/([^/]+)\/([^/]+)\.json$/);
  if (!match) continue;
  const [, language, namespace] = match;
  resources[language] ??= {};
  resources[language][namespace] = mod.default;
}

export const localesBackend = resourcesToBackend(
  (language: string, namespace: string) =>
    Promise.resolve(resources[language]?.[namespace] ?? {}),
);
