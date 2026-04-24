import {data, type ActionFunctionArgs} from 'react-router';
import {composeGid} from '@shopify/admin-graphql-api-utilities';
import i18n from '~/i18n/i18n.server';
import {authenticate} from '~/shopify.server';
import type {TypedResponse, WithToast} from '~/types';
import {toast} from '~/utils/toast';
import CustomerUpdateMutation from '~/graphql/CustomerUpdateMutation';

export async function action({
  request,
  params,
}: ActionFunctionArgs): Promise<TypedResponse<WithToast<{error?: boolean}>>> {
  const t = await i18n.getFixedT(request, 'app.contracts');
  const body = await request.formData();
  const {admin} = await authenticate.admin(request);
  const email = body.get('email') as string;
  const customerId = body.get('customerId') as string;

  const updateEmailError = data({
    error: true,
    ...toast(t('customerDetails.emailModal.errorMessage'), {isError: true}),
  });

  if (!email || !customerId) {
    return updateEmailError;
  }

  try {
    const response = await admin.graphql(CustomerUpdateMutation, {
      variables: {
        input: {
          id: customerId,
          email,
        },
      },
    });

    const {data: responseData} = await response.json();

    if (
      !responseData?.customerUpdate?.customer?.id ||
      responseData.customerUpdate.userErrors.length > 0
    ) {
      return updateEmailError;
    }

    return data(toast(t('customerDetails.emailModal.successMessage')));
  } catch {
    return updateEmailError;
  }
}
