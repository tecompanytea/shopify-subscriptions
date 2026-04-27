import {data} from 'react-router';
import {
  isRouteErrorResponse,
  Link,
  Outlet,
  useLoaderData,
  useRouteError,
} from 'react-router';
import {parseGid} from '@shopify/admin-graphql-api-utilities';
import {NavMenu} from '@shopify/app-bridge-react';
import {boundary} from '@shopify/shopify-app-react-router/server';
import {useTranslation} from 'react-i18next';
import {ShopifyAppProvider} from '~/components/ShopifyAppProvider';
import ShopContext from '~/context/ShopContext';
import {ErrorBoundaryCard} from '~/components/ErrorBoundaryCard';

import {getShopInfos} from '~/models/ShopInfo/ShopInfo.server';
import {authenticate} from '~/shopify.server';
import {missingApprovedScopes} from '~/utils/missingApprovedScopes';

export const handle = {
  i18n: 'common',
};

export async function loader({request}) {
  const {admin, redirect} = await authenticate.admin(request);

  if (
    process.env.NODE_ENV === 'development' &&
    missingApprovedScopes().length > 0
  ) {
    return redirect('/missing-scopes');
  }

  const shopInfos = await getShopInfos(admin.graphql);
  const {shop} = shopInfos;
  const {primaryDomain, currencyCode, contactEmail, name, email, ianaTimezone} =
    shop;
  const shopId = Number(parseGid(shop.id));
  const shopifyDomain = primaryDomain.url as string;

  return data({
    apiKey: process.env.SHOPIFY_API_KEY || '',
    shopId,
    name,
    shopifyDomain,
    currencyCode,
    ianaTimezone,
    contactEmail,
    email,
  });
}

export default function App() {
  const {
    apiKey,
    shopId,
    name,
    shopifyDomain,
    ianaTimezone,
    currencyCode,
    contactEmail,
    email,
  } = useLoaderData<typeof loader>();
  const {t} = useTranslation('common');

  const shopInfo = {
    shopId,
    name,
    shopifyDomain,
    ianaTimezone,
    currencyCode,
    contactEmail,
    email,
  };

  return (
    <>
      <ShopifyAppProvider embedded apiKey={apiKey}>
        <ShopContext.Provider value={shopInfo}>
          <NavMenu>
            <Link to="/app" rel="home">
              {t('navigation.home')}
            </Link>
            <Link to="/app/plans">{t('navigation.plans')}</Link>

            <Link to="/app/settings">{t('navigation.settings')}</Link>
          </NavMenu>
          <Outlet />
        </ShopContext.Provider>
      </ShopifyAppProvider>
    </>
  );
}

function isSerializedRouteResponse(error: unknown): error is {data?: unknown} {
  return (
    error !== null &&
    typeof error === 'object' &&
    'status' in error &&
    'statusText' in error &&
    'data' in error
  );
}

export function renderRouteError(error: unknown) {
  try {
    return boundary.error(error);
  } catch {
    if (isRouteErrorResponse(error) || isSerializedRouteResponse(error)) {
      const data = (error as {data?: unknown}).data;
      return (
        <div
          dangerouslySetInnerHTML={{
            __html: typeof data === 'string' && data ? data : 'Handling response',
          }}
        />
      );
    }

    throw error;
  }
}

export function ErrorBoundary() {
  const error = useRouteError();
  try {
    return renderRouteError(error);
  } catch {
    if (process.env.NODE_ENV === 'development') {
      console.error(error);
    }

    function getApiKey() {
      if (typeof window === 'undefined') {
        return process.env.SHOPIFY_API_KEY!;
      } else if (document.querySelector('script[data-api-key]')) {
        return (
          (document.querySelector('script[data-api-key]') as HTMLScriptElement)
            ?.dataset?.apiKey ?? ''
        );
      }
      return '';
    }

    return (
      <ShopifyAppProvider embedded apiKey={getApiKey()}>
        <ErrorBoundaryCard />
      </ShopifyAppProvider>
    );
  }
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
