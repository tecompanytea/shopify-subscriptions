import {data} from 'react-router';
import type {ActionFunctionArgs} from 'react-router';
import {authenticate} from '~/shopify.server';
import SubscriptionBillingAttemptQuery from '~/graphql/SubscriptionBillingAttemptQuery';
import {logger} from '~/utils/logger.server';
import type {TypedResponse} from '~/types';

// This code is tested in the context of where it is used on the contract details page
// tests are available in the ContractDetails.test.tsx file
export async function action({
  request,
  params,
}: ActionFunctionArgs): Promise<TypedResponse<{ready: boolean; id?: string}>> {
  const {admin} = await authenticate.admin(request);
  const body = await request.formData();
  const billingAttemptId = (body.get('billingAttemptId') as string) || '';
  const response = await admin.graphql(SubscriptionBillingAttemptQuery, {
    variables: {
      billingAttemptId,
    },
  });

  const {data: responseData} = await response.json();
  const ready = responseData?.subscriptionBillingAttempt?.ready;
  const id = responseData?.subscriptionBillingAttempt?.id;
  if (!ready || !id) {
    logger.error(
      'Received invalid response from SubscriptionBillingAttemptQuery. Expected properties `subscriptionBillingAttempt.ready` and `subscriptionBillingAttempt.id`, received ',
      {data: responseData, billingAttemptId},
    );
    return data({ready: false});
  }
  return data({ready, id});
}

export function shouldRevalidate() {
  return false;
}
