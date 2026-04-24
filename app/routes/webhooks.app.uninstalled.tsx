import type {ActionFunctionArgs} from 'react-router';
import {authenticate} from '~/shopify.server';
import {logger} from '~/utils/logger.server';
import {DisableShopJob, jobs} from '~/jobs';

export const action = async ({request}: ActionFunctionArgs) => {
  const {topic, shop, payload} = await authenticate.webhook(request);

  logger.info({topic, shop, payload}, 'Received webhook');

  jobs.enqueue(new DisableShopJob({shop, payload: {}}));

  return new Response();
};
