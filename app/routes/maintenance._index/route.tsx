import {ShopifyAppProvider} from '~/components/ShopifyAppProvider';
import {Layout, Page, Text} from '~/components/polaris';

export async function loader() {
  return new Response(null, {status: 503});
}

export async function action() {
  return new Response(null, {status: 503});
}

export default function Maintenance() {
  return (
    <ShopifyAppProvider embedded={false}>
      <Page title="Scheduled maintenance">
        <Layout>
          <Layout.Section>
            <Text as="p">
              The subscriptions app is undergoing scheduled maintenance. Please
              check back in a few minutes.
            </Text>
          </Layout.Section>
        </Layout>
      </Page>
    </ShopifyAppProvider>
  );
}
