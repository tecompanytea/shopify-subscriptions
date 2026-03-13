import {useTranslation} from 'react-i18next';
import {json, type LoaderFunctionArgs} from '@remix-run/node';
import {Link, useLoaderData} from '@remix-run/react';
import {BlockStack, Card, Layout, List, Page, Text} from '~/components/polaris';
import {ShopifyAppProvider} from '~/components/ShopifyAppProvider';

import {authenticate} from '~/shopify.server';
import {missingApprovedScopes} from '~/utils/missingApprovedScopes';

export async function loader({request}: LoaderFunctionArgs) {
  await authenticate.admin(request);
  const scopes = missingApprovedScopes();

  return json({scopes});
}

export default function MissingScopes() {
  const {t} = useTranslation('common');
  const {scopes} = useLoaderData<typeof loader>();

  return (
    <ShopifyAppProvider embedded={false}>
      <Page narrowWidth>
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <Text as="h2" variant="headingMd" fontWeight="bold">
                  {t('missingScopes.title')}
                </Text>

                <Text as="p">{t('missingScopes.description')}</Text>

                <List>
                  {scopes.map((scope) => (
                    <List.Item key={scope}>
                      <pre>{scope}</pre>
                    </List.Item>
                  ))}
                </List>

                <Text as="p">
                  {t('missingScopes.link', {
                    link: (
                      <Link
                        to="https://shopify.dev/docs/apps/build/purchase-options/subscriptions/subscriptions-app/start-building#scopes-request"
                        target="_blank"
                      >
                        {t('missingScopes.linkText')}
                      </Link>
                    ),
                  })}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </ShopifyAppProvider>
  );
}
