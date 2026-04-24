import {data} from 'react-router';
import type {ActionFunctionArgs} from 'react-router';
import {composeGid} from '@shopify/admin-graphql-api-utilities';
import i18n from '~/i18n/i18n.server';
import {SubscriptionContractPauseService} from '~/services/SubscriptionContractPauseService';
import {authenticate} from '~/shopify.server';
import type {TypedResponse, WithToast} from '~/types';
import {toast} from '~/utils/toast';

// This code is tested in the context of where it is used on the contract details page
// tests are available in the ContractDetails.test.tsx file
export async function action({
  request,
  params,
}: ActionFunctionArgs): Promise<TypedResponse<WithToast>> {
  const {admin, session} = await authenticate.admin(request);
  const t = await i18n.getFixedT(request, 'app.contracts');
  const contractId = composeGid('SubscriptionContract', params.id || '');

  const pauseError = data(toast(t('actions.pause.error'), {isError: true}));

  if (typeof contractId !== 'string') {
    return pauseError;
  }

  try {
    await new SubscriptionContractPauseService(
      admin.graphql,
      session.shop,
      contractId,
    ).run();

    return data(toast(t('actions.pause.success')));
  } catch (e) {
    return pauseError;
  }
}
