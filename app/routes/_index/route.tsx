import {json, redirect} from '@remix-run/node';
import type {MetaFunction} from '@remix-run/react';
import {Form, useLoaderData} from '@remix-run/react';
import {
  BlockStack,
  Button,
  Card,
  FormLayout,
  InlineStack,
  Page,
  Text,
  TextField,
} from '~/components/polaris';
import {useCallback, useState} from 'react';
import {ShopifyAppProvider} from '~/components/ShopifyAppProvider';

import {login} from '../../shopify.server';

export async function loader({request}) {
  const url = new URL(request.url);

  if (url.searchParams.get('shop')) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return json({
    showForm: Boolean(login),
  });
}

export const meta: MetaFunction = () => {
  return [{title: 'Subscriptions by Shopify'}];
};

export default function App() {
  const {showForm} = useLoaderData<typeof loader>();

  const [textFieldValue, setTextFieldValue] = useState('');

  const handleTextFieldChange = useCallback(
    (value: string) => setTextFieldValue(value),
    [],
  );

  return (
    <ShopifyAppProvider embedded={false}>
      <section
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          paddingLeft: '32px',
          paddingRight: '32px',
          backgroundColor: 'var(--p-color-bg)',
        }}
      >
        <Page narrowWidth>
          <InlineStack>
            <Card>
              <BlockStack gap="200">
                <Text as="h1" variant="headingLg">
                  Subscriptions
                </Text>
                {showForm && (
                  <Form method="post" action="/auth/login">
                    <FormLayout>
                      <TextField
                        label="Enter your shop domain to log in or install this app."
                        type="text"
                        value={textFieldValue}
                        onChange={handleTextFieldChange}
                        autoComplete="off"
                        name="shop"
                        placeholder="example.myshopify.com"
                      />
                      <Button submit variant="primary">
                        Install app
                      </Button>
                    </FormLayout>
                  </Form>
                )}
              </BlockStack>
            </Card>
          </InlineStack>
        </Page>
      </section>
    </ShopifyAppProvider>
  );
}
