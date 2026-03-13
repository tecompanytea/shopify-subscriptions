import {json} from '@remix-run/node';
import {
  Button,
  Card,
  FormLayout,
  Page,
  Text,
  TextField,
} from '~/components/polaris';
import {useState} from 'react';

import {Form, useActionData, useLoaderData} from '@remix-run/react';
import {ShopifyAppProvider} from '~/components/ShopifyAppProvider';

import {login} from '../../shopify.server';
import {loginErrorMessage} from './error.server';

export async function loader({request}) {
  const errors = loginErrorMessage(await login(request));

  return json({
    errors,
  });
}

export async function action({request}) {
  const errors = loginErrorMessage(await login(request));

  return json({
    errors,
  });
}

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState('');
  const {errors} = actionData || loaderData;

  return (
    <ShopifyAppProvider embedded={false}>
      <Page>
        <Card>
          <Form method="post">
            <FormLayout>
              <Text variant="headingMd" as="h2">
                Log in
              </Text>
              <TextField
                type="text"
                name="shop"
                label="Shop domain"
                helpText="example.myshopify.com"
                value={shop}
                onChange={setShop}
                autoComplete="on"
                error={'shop' in errors ? errors.shop : undefined}
              />
              <Button submit>Log in</Button>
            </FormLayout>
          </Form>
        </Card>
      </Page>
    </ShopifyAppProvider>
  );
}
