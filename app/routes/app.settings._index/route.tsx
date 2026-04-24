import {Box, InlineStack, Layout, Page} from '~/components/polaris';

import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from 'react-router';
import {data} from 'react-router';
import {useLoaderData} from 'react-router';
import {useTranslation} from 'react-i18next';
import type {ValidationErrorResponseData} from '@rvf/react-router';
import {validationError} from '@rvf/react-router';
import {Form} from '~/components/Form';
import {SubmitButton} from '~/components/SubmitButton';
import i18n from '~/i18n/i18n.server';
import type {TypedResponse, WithToast} from '~/types';
import {
  loadSettingsMetaobject,
  updateSettingsMetaobject,
} from '../../models/Settings/Settings.server';
import {authenticate} from '../../shopify.server';
import {
  BillingFailureSettings,
  SubscriptionNotificationsSettings,
} from './components/BillingFailureSettings';
import {getSettingsSchema, useSettingsSchema} from './validator';
import {useToasts} from '~/hooks';
import {toast} from '~/utils/toast';
import {validateFormData} from '~/utils/validateFormData';

export const handle = {
  i18n: 'app.settings',
};

export const loader = async ({request}: LoaderFunctionArgs) => {
  const {admin} = await authenticate.admin(request);

  const settings = await loadSettingsMetaobject(admin.graphql);
  return data({settings});
};

export async function action({
  request,
}: ActionFunctionArgs): Promise<
  TypedResponse<WithToast<Partial<ValidationErrorResponseData>>>
> {
  const {admin} = await authenticate.admin(request);
  const formData = await request.formData();
  const t = await i18n.getFixedT(request, 'app.settings');
  const validationResult = await validateFormData(
    getSettingsSchema(t),
    formData,
  );

  if (validationResult.error) {
    return validationError(validationResult.error);
  }

  const {success} = await updateSettingsMetaobject(
    admin.graphql,
    validationResult.data,
  );

  if (!success) {
    return data(toast(t('actions.updateFailed'), {isError: true}));
  }

  return data(toast(t('actions.updateSuccess')));
}

export default function SettingsIndex() {
  const {settings} = useLoaderData<typeof loader>();
  useToasts();

  const {t} = useTranslation('app.settings');
  const schema = useSettingsSchema();

  return (
    <Page title={t('title')}>
      <Box paddingBlockEnd="400">
        <Form schema={schema} defaultValues={settings}>
          <input type="hidden" value={settings.id} name="id" />
          <Layout>
            <Layout.Section>
              <BillingFailureSettings />
            </Layout.Section>
            <Layout.Section>
              <SubscriptionNotificationsSettings />
            </Layout.Section>

            <Layout.Section>
              <InlineStack align="end" gap="200">
                <SubmitButton>{t('saveButtonText')}</SubmitButton>
              </InlineStack>
            </Layout.Section>
          </Layout>
        </Form>
      </Box>
    </Page>
  );
}
