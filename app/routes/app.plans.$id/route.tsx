import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from 'react-router';
import {data,redirect} from 'react-router';
import {useLoaderData, useSearchParams} from 'react-router';
import {composeGid, parseGid} from '@shopify/admin-graphql-api-utilities';
import {Page} from '~/components/polaris';
import {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import i18n from '~/i18n/i18n.server';
import {
  createSellingPlanGroup,
  getSellingPlanGroup,
  updateSellingPlanGroup,
} from '~/models/SellingPlan/SellingPlan.server';
import {authenticate} from '~/shopify.server';
import {SubscriptionPlanForm} from './components/SubscriptionPlanForm';
import {getEmptySellingPlan} from './utils';
import {
  DiscountType,
  getSellingPlanFormSchema,
  SellingPlanMode,
  useSellingPlanFormSchema,
} from './validator';

import {Form} from '~/components/Form/Form';
import {validationError, type ValidationErrorResponseData} from '@rvf/react-router';
import type {TypedResponse, SellingPlanGroup, WithToast} from '~/types';
import {MAX_SELLING_PLAN_PRODUCTS} from '~/utils/constants';
import {formStringToArray} from '~/utils/helpers/form';
import {toast} from '~/utils/toast';
import {useToasts} from '~/hooks';
import {validateFormData} from '~/utils/validateFormData';

export const handle = {
  i18n: 'app.plans.details',
};

export async function loader({
  request,
  params,
}: LoaderFunctionArgs): Promise<
  TypedResponse<WithToast<{sellingPlanGroup: SellingPlanGroup}>>
> {
  const {admin} = await authenticate.admin(request);
  const t = await i18n.getFixedT(request, 'app.plans.details');
  const planID = params.id;
  const url = new URL(request.url);

  if (planID === 'create') {
    const sellingPlanMode =
      url.searchParams.get('mode') === 'prepaid'
        ? SellingPlanMode.PREPAID
        : SellingPlanMode.RECURRING;

    return data({
      sellingPlanGroup: getEmptySellingPlan(t, sellingPlanMode),
    });
  }

  if (!planID) {
    throw data({error: 'Plan not found'}, {status: 404});
  }

  const sellingPlanGroup = await getSellingPlanGroup(admin.graphql, {
    id: composeGid('SellingPlanGroup', planID),
    firstProducts: MAX_SELLING_PLAN_PRODUCTS,
  });

  if (!sellingPlanGroup) {
    throw new Response(null, {
      status: 404,
      statusText: t('SubscriptionPlanForm.missingSellingPlanGroup'),
    });
  }

  const planCreated = url.searchParams.get('planCreated');
  const createdToast = planCreated
    ? toast(t('SubscriptionPlanForm.createSuccess'))
    : undefined;

  return data({sellingPlanGroup, ...createdToast});
}

export async function action({
  request,
  params,
}: ActionFunctionArgs): Promise<
  TypedResponse<WithToast<Partial<ValidationErrorResponseData>>>
> {
  const {admin} = await authenticate.admin(request);
  const t = await i18n.getFixedT(request, 'app.plans.details');
  const planID = params.id;

  const validationResult = await validateFormData(
    getSellingPlanFormSchema(t),
    await request.formData(),
  );

  if (validationResult.error) {
    return validationError(validationResult.error);
  }

  const {
    merchantCode,
    planName,
    selectedProductIds,
    selectedVariantIds,
    removedProductIds,
    removedVariantIds,
    discountDeliveryOptions,
    sellingPlanMode,
    sellingPlanIdsToDelete,
    offerDiscount,
    discountType,
    shopCurrencyCode,
  } = validationResult.data;

  if (planID === 'create') {
    const {sellingPlanGroupId, userErrors} = await createSellingPlanGroup(
      admin.graphql,
      {
        merchantCode: merchantCode,
        name: planName,
        productIds: formStringToArray(selectedProductIds),
        productVariantIds: formStringToArray(selectedVariantIds),
        discountDeliveryOptions: discountDeliveryOptions || [],
        sellingPlanMode: sellingPlanMode || SellingPlanMode.RECURRING,
        offerDiscount: Boolean(offerDiscount),
        discountType: discountType || DiscountType.PERCENTAGE,
        currencyCode: shopCurrencyCode || 'USD',
      },
    );

    if (!sellingPlanGroupId || userErrors?.length) {
      return data(
        toast(
          userErrors?.[0]?.message || t('SubscriptionPlanForm.createError'),
          {isError: true},
        ),
        {status: 500},
      );
    }

    return redirect(
      `/app/plans/${parseGid(sellingPlanGroupId)}?planCreated=true`,
      {},
    );
  } else if (planID) {
    const existingSellingPlanGroup = await getSellingPlanGroup(admin.graphql, {
      id: composeGid('SellingPlanGroup', planID),
      firstProducts: MAX_SELLING_PLAN_PRODUCTS,
    });

    if (!existingSellingPlanGroup) {
      throw data({error: 'Plan not found'}, {status: 404});
    }

    if (existingSellingPlanGroup.hasUnsupportedSellingPlans) {
      return data(
        toast(t('SubscriptionPlanForm.unsupportedSellingPlanConfiguration'), {
          isError: true,
        }),
        {status: 400},
      );
    }

    const {sellingPlanGroupId, userErrors} = await updateSellingPlanGroup(
      admin.graphql,
      {
        id: composeGid('SellingPlanGroup', planID),
        merchantCode,
        name: planName,
        discountDeliveryOptions: discountDeliveryOptions || [],
        sellingPlanMode: existingSellingPlanGroup.sellingPlanMode,
        sellingPlansToDelete: formStringToArray(sellingPlanIdsToDelete),
        offerDiscount: Boolean(offerDiscount),
        discountType: discountType || DiscountType.PERCENTAGE,
        currencyCode: shopCurrencyCode || 'USD',
        productIdsToAdd: formStringToArray(selectedProductIds),
        productVariantIdsToAdd: formStringToArray(selectedVariantIds),
        productIdsToRemove: formStringToArray(removedProductIds),
        productVariantIdsToRemove: formStringToArray(removedVariantIds),
      },
    );

    if (!sellingPlanGroupId || userErrors?.length) {
      return data(
        toast(userErrors[0]?.message || t('SubscriptionPlanForm.updateError'), {
          isError: true,
        }),
        {status: 500},
      );
    }

    return data(toast(t('SubscriptionPlanForm.updateSuccess')));
  } else {
    throw data({error: 'Plan not found'}, {status: 404});
  }
}

export default function SellingPlanDetails() {
  const {t} = useTranslation('app.plans.details');
  const {sellingPlanGroup} = useLoaderData<typeof loader>();
  const schema = useSellingPlanFormSchema();
  const [searchParams, setSearchParams] = useSearchParams();
  useToasts();

  const {selectedProductIds, selectedProductVariantIds} = sellingPlanGroup;
  const discountDeliveryOptions =
    sellingPlanGroup.discountDeliveryOptions || [];

  useEffect(() => {
    if (searchParams.has('planCreated')) {
      searchParams.delete('planCreated');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  return (
    <Page
      backAction={{content: t('backButtonLabel'), url: '/app/plans'}}
      title={sellingPlanGroup?.merchantCode || t('create.pageTitle')}
    >
      <Form schema={schema} defaultValues={sellingPlanGroup}>
        <SubscriptionPlanForm
          selectedProductIds={selectedProductIds}
          selectedVariantIds={selectedProductVariantIds}
          sellingPlanGroupName={sellingPlanGroup.merchantCode}
          discountDeliveryOptions={discountDeliveryOptions}
          sellingPlanMode={sellingPlanGroup.sellingPlanMode}
          hasUnsupportedSellingPlans={Boolean(
            sellingPlanGroup.hasUnsupportedSellingPlans,
          )}
        />
      </Form>
    </Page>
  );
}
