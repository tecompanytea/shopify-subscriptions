import ShopifyFormat from '@shopify/i18next-shopify';
import type {TFunction} from 'i18next';
import {createInstance} from 'i18next';
import Backend from 'i18next-fs-backend';
import {resolve} from 'node:path';
import {initReactI18next} from 'react-i18next';
import type {EntryContext} from 'react-router';

import i18nextOptions from './i18nextOptions';

const SUPPORTED = new Set(i18nextOptions.supportedLngs);

export function getLocale(request: Request): string {
  const param = new URL(request.url).searchParams.get('locale');
  if (param && SUPPORTED.has(param)) return param;
  return i18nextOptions.fallbackLng;
}

export function getRouteNamespaces(context: EntryContext): string[] {
  const namespaces = Object.values(context.routeModules).flatMap((mod) => {
    const handle = (mod as {handle?: unknown} | undefined)?.handle;
    if (!handle || typeof handle !== 'object' || !('i18n' in handle)) {
      return [];
    }
    const value = (handle as {i18n: unknown}).i18n;
    if (typeof value === 'string') return [value];
    if (Array.isArray(value) && value.every((x) => typeof x === 'string')) {
      return value as string[];
    }
    return [];
  });
  return [...new Set(namespaces)];
}

async function createServerInstance(
  locale: string,
  namespaces: string | string[],
) {
  const instance = createInstance();
  await instance
    .use(initReactI18next)
    .use(ShopifyFormat.default ?? ShopifyFormat)
    .use(Backend)
    .init({
      ...i18nextOptions,
      lng: locale,
      ns: namespaces,
      backend: {loadPath: resolve('./public/locales/{{lng}}/{{ns}}.json')},
    });
  return instance;
}

export async function getFixedT(
  requestOrLocale: Request | string,
  namespaces: string | string[] = i18nextOptions.defaultNS,
  keyPrefix?: string,
): Promise<TFunction> {
  const locale =
    typeof requestOrLocale === 'string'
      ? requestOrLocale
      : getLocale(requestOrLocale);
  const instance = await createServerInstance(locale, namespaces);
  return instance.getFixedT(locale, namespaces, keyPrefix);
}

const i18nServer = {
  getLocale,
  getRouteNamespaces,
  getFixedT,
};

export default i18nServer;
