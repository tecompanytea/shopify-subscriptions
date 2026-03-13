import {Fragment, type ReactNode} from 'react';

type ShopifyAppProviderProps = {
  children: ReactNode;
  embedded?: boolean;
  apiKey?: string;
};

export function ShopifyAppProvider({
  children,
  embedded = false,
  apiKey,
}: ShopifyAppProviderProps) {
  return (
    <Fragment>
      {embedded && apiKey ? (
        <script
          src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
          data-api-key={apiKey}
        />
      ) : null}
      {children}
    </Fragment>
  );
}
