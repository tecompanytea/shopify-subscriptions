import {data, type ActionFunctionArgs} from 'react-router';
import {composeGid} from '@shopify/admin-graphql-api-utilities';
import PaymentUpdateDetailsQuery from '~/graphql/PaymentUpdateDetailsQuery';
import i18n from '~/i18n/i18n.server';
import {sendPaymentMethodUpdateEmail} from '~/services/SendPaymentMethodUpdateEmailService';
import {authenticate} from '~/shopify.server';
import type {TypedResponse, WithToast} from '~/types';
import {toast} from '~/utils/toast';

// This code is tested in the context of where it is used on the contract details page
// tests are available in the CustomerPaymentMethodEmailModal.test.tsx file
export async function action({
  request,
  params,
}: ActionFunctionArgs): Promise<TypedResponse<WithToast<{error?: boolean}>>> {
  const {admin} = await authenticate.admin(request);
  const t = await i18n.getFixedT(request, 'app.contracts');
  const contractId = composeGid('SubscriptionContract', params.id || '');

  const emailError = data({
    error: true,
    ...toast(t('paymentMethodDetails.emailModal.errorMessage'), {
      isError: true,
    }),
  });

  const response = await admin.graphql(PaymentUpdateDetailsQuery, {
    variables: {contractId},
  });

  const {data: responseData} = await response.json();

  if (!responseData) {
    return emailError;
  }

  const {name: shopName, contactEmail: shopEmail} = responseData?.shop;
  const subscriptionContract = responseData?.subscriptionContract;
  const customerEmail = subscriptionContract?.customer?.email;
  const customerPaymentMethodId =
    subscriptionContract?.customerPaymentMethod?.id;

  if (!shopEmail || !customerEmail || !customerPaymentMethodId) {
    return emailError;
  }

  const subjectMessage = t('paymentMethodDetails.emailModal.subjectMessage', {
    shopName,
  });

  const sendEmailResponse = await sendPaymentMethodUpdateEmail(
    admin.graphql,
    customerPaymentMethodId,
    {
      from: shopEmail,
      to: customerEmail,
      subject: subjectMessage,
    },
  );

  const {customer, userErrors} = sendEmailResponse || {};

  if (!customer || userErrors?.length) {
    return emailError;
  }

  return data(toast(t('paymentMethodDetails.emailModal.successMessage')));
}
