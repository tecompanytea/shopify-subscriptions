import type {ActionFunctionArgs, LoaderFunctionArgs} from 'react-router';

import {CustomerSendEmailJob, jobs} from '~/jobs';
import {authenticate} from '~/shopify.server';
import {logger} from '~/utils/logger.server';

export async function loader({request}: LoaderFunctionArgs) {
  const {cors} = await authenticate.public.customerAccount(request);
  return cors(Response.json({body: 'data'}));
}

export async function action({request}: ActionFunctionArgs) {
  // returns early without any error if authentication fails
  // ie: request comess from a non-customer-account context
  const {sessionToken, cors} =
    await authenticate.public.customerAccount(request);

  const {sub: customerGid, dest: shopDomain} = sessionToken;

  const body = await request.json();

  const {admin_graphql_api_id, operationName} = body;

  try {
    if (['PAUSE', 'RESUME'].includes(operationName)) {
      jobs.enqueue(
        new CustomerSendEmailJob({
          payload: {
            admin_graphql_api_id,
            admin_graphql_api_customer_id: customerGid,
            emailTemplate:
              operationName === 'PAUSE'
                ? 'SUBSCRIPTION_PAUSED'
                : 'SUBSCRIPTION_RESUMED',
          },
          shop: shopDomain,
        }),
      );
    } else {
      throw new Error(`Invalid operation name: ${operationName ?? ''}`);
    }

    return cors(Response.json({status: 'success'}, {status: 200}));
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));

    logger.error({error}, 'Customer account job execution failed', {
      shop: shopDomain,
      customer: customerGid,
    });

    return cors(
      Response.json({status: 'failure', error: error.message}, {status: 500}),
    );
  }
}
