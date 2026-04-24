import {
  json,
  type TypedResponse,
  type ActionFunctionArgs,
} from '@remix-run/node';
import {composeGid} from '@shopify/admin-graphql-api-utilities';
import i18n from '~/i18n/i18next.server';
import {authenticate} from '~/shopify.server';
import type {WithToast} from '~/types';
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

  const updateEmailError = json({
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

    const {data} = await response.json();

    if (
      !data?.customerUpdate?.customer?.id ||
      data.customerUpdate.userErrors.length > 0
    ) {
      return updateEmailError;
    }

    return json(toast(t('customerDetails.emailModal.successMessage')));
  } catch {
    return updateEmailError;
  }
}
