import i18nextOptions from './i18nextOptions';

const DEFAULT_NAMESPACES = [
  'common',
  'app.contracts',
  'app.plans',
  'app.plans.details',
  'app.settings',
];

export function getInitialNamespaces(): string[] {
  const set = new Set<string>(DEFAULT_NAMESPACES);
  if (i18nextOptions.defaultNS) {
    set.add(i18nextOptions.defaultNS);
  }
  return [...set];
}
