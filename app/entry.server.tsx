import {createReadableStreamFromReadable} from '@react-router/node';
import ShopifyFormat from '@shopify/i18next-shopify';
import {createInstance} from 'i18next';
import Backend from 'i18next-fs-backend';
import {isbot} from 'isbot';
import {resolve} from 'node:path';
import {renderToPipeableStream} from 'react-dom/server';
import {I18nextProvider, initReactI18next} from 'react-i18next';
import type {
  ActionFunctionArgs,
  AppLoadContext,
  EntryContext,
  LoaderFunctionArgs,
} from 'react-router';
import {ServerRouter} from 'react-router';
import {PassThrough} from 'stream';

import {logger} from '~/utils/logger.server';
import {getLocale, getRouteNamespaces} from './i18n/i18n.server';
import i18nextOptions from './i18n/i18nextOptions';
import {addDocumentResponseHeaders} from './shopify.server';

// Reject/cancel all pending promises after 5 seconds
export const streamTimeout = 5000;

const APP_CONTENT_SECURITY_POLICY =
  "default-src 'self'; \
  script-src 'self' 'unsafe-inline' https://cdn.shopify.com; \
  style-src 'self' 'unsafe-inline' https://cdn.shopify.com; \
  font-src 'self' https://cdn.shopify.com; \
  img-src 'self' data: https://cdn.shopify.com; \
  connect-src 'self' https://atlas.shopifysvc.com https://extensions.shopifycdn.com https://cdn.shopify.com; \
  upgrade-insecure-requests";

export function mergeContentSecurityPolicyHeaders(headers: Headers): void {
  const shopifyPolicy = headers.get('Content-Security-Policy');
  headers.set(
    'Content-Security-Policy',
    [shopifyPolicy, APP_CONTENT_SECURITY_POLICY].filter(Boolean).join(' '),
  );
}

export function handleError(
  error: Error,
  {request: req, params, context}: LoaderFunctionArgs | ActionFunctionArgs,
): void {
  if (error instanceof Error === false) {
    return;
  }

  if (req.signal.aborted) {
    return;
  }

  const {url, method, headers} = req;
  const request = {
    url,
    method,
    headers: Object.fromEntries(headers.entries()),
  };

  const {message} = error;
  logger.error({err: error, request, params, context}, message);
}

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  entryContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  addDocumentResponseHeaders(request, responseHeaders);

  const i18next = createInstance();
  const lng = getLocale(request);
  const ns = getRouteNamespaces(entryContext);

  await i18next
    .use(initReactI18next)
    .use(ShopifyFormat.default ?? ShopifyFormat)
    .use(Backend)
    .init({
      ...i18nextOptions,
      lng,
      ns,
      backend: {loadPath: resolve('./public/locales/{{lng}}/{{ns}}.json')},
    });

  const callbackName = isbot(request.headers.get('user-agent'))
    ? 'onAllReady'
    : 'onShellReady';

  return new Promise((resolvePromise, reject) => {
    const {pipe, abort} = renderToPipeableStream(
      <I18nextProvider i18n={i18next}>
        <ServerRouter context={entryContext} url={request.url} />
      </I18nextProvider>,
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set('Content-Type', 'text/html');
          responseHeaders.set('X-Content-Type-Options', 'nosniff');
          responseHeaders.set('X-Download-Options', 'noopen');
          responseHeaders.set('X-Permitted-Cross-Domain-Policies', 'none');
          responseHeaders.set('Referrer-Policy', 'origin-when-cross-origin');
          mergeContentSecurityPolicyHeaders(responseHeaders);
          responseHeaders.set(
            'Strict-Transport-Security',
            'max-age=631138519; includeSubDomains',
          );

          resolvePromise(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );

          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          logger.error(error);
        },
      },
    );

    // Automatically timeout the React renderer after 6 seconds, which ensures
    // React has enough time to flush down the rejected boundary contents
    setTimeout(abort, streamTimeout + 1000);
  });
}
