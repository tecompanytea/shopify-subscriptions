import {data} from 'react-router';
import type {ActionFunctionArgs} from 'react-router';
import {composeGid} from '@shopify/admin-graphql-api-utilities';
import {authenticate} from '~/shopify.server';
import type {TypedResponse, WithToast} from '~/types';
import {toast} from '~/utils/toast';
import SubscriptionBillingCycleChargeIndexMutation from '~/graphql/SubscriptionBillingCycleChargeIndexMutation';
import i18n from '~/i18n/i18n.server';
import {logger} from '~/utils/logger.server';
import type {SubscriptionBillingAttemptInventoryPolicy} from '../../../types/admin.types';

// This code is tested in the context of where it is used on the contract details page
// tests are available in the ContractDetails.test.tsx file
export async function action({
  request,
  params,
}: ActionFunctionArgs): Promise<TypedResponse<WithToast<{id?: string}>>> {
  const {admin} = await authenticate.admin(request);
  const t = await i18n.getFixedT(request, 'app.contracts');
  const contractId = composeGid('SubscriptionContract', params.id || '');

  const body = await request.formData();
  const inventoryPolicy = body.get('inventoryPolicy');
  const cycleIndex = body.get('cycleIndex');
  if (!cycleIndex) {
    logger.error('missing cycleIndex in request body', {body});
    return data(toast(t('actions.billContract.error'), {isError: true}));
  }

  const response = await admin.graphql(
    SubscriptionBillingCycleChargeIndexMutation,
    {
      variables: {
        subscriptionContractId: contractId,
        inventoryPolicy:
          inventoryPolicy as SubscriptionBillingAttemptInventoryPolicy,
        index: Number(cycleIndex),
      },
    },
  );

  const {data: responseData} = await response.json();
  let billingAttempt =
    responseData?.subscriptionBillingCycleCharge?.subscriptionBillingAttempt;
  if (!billingAttempt) {
    logger.error(
      'Received invalid response from SubscriptionBillingCycleChargeIndex mutation. Expected property `subscriptionBillingCycleCharge.subscriptionBillingAttempt`, received ',
      {data: responseData, contractId},
    );
    return data(toast(t('actions.billContract.error'), {isError: true}));
  }
  const id = billingAttempt.id;
  return data({
    id,
    ...toast(t('actions.billContract.success')),
  });
}

export function shouldRevalidate() {
  return false;
}
