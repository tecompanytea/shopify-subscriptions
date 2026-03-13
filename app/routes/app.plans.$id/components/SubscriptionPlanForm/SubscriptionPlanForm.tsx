import {useLocation} from '@remix-run/react';
import {
  Banner,
  BlockStack,
  Button,
  Card,
  FormLayout,
  Layout,
  Link,
  PageActions,
  Text,
} from '~/components/polaris';
import {useFormContext} from '@rvf/remix';
import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {SubmitButton} from '~/components/SubmitButton';
import {TextField} from '~/components/TextField';
import {DiscountDeliveryCard} from './components/DiscountDeliveryCard';
import {ProductPickerCard} from './components/ProductPickerCard';
import {SummaryCard} from './components/SummaryCard';
import DeleteSellingPlanGroupModal from '../DeleteSellingPlanModal/DeleteSellingPlanModal';
import {
  RadioButton,
} from '~/components/RadioButton';
import type {
  DiscountDeliveryOption,
  SellingPlanModeType,
} from '../../validator';
import {SellingPlanMode} from '../../validator';

export interface SubscriptionPlanFormProps {
  selectedVariantIds: string;
  selectedProductIds: string;
  sellingPlanGroupName: string;
  discountDeliveryOptions: DiscountDeliveryOption[];
  sellingPlanMode: SellingPlanModeType;
  hasUnsupportedSellingPlans: boolean;
}

export function SubscriptionPlanForm({
  selectedProductIds,
  selectedVariantIds,
  sellingPlanGroupName,
  discountDeliveryOptions,
  sellingPlanMode,
  hasUnsupportedSellingPlans,
}: SubscriptionPlanFormProps) {
  const {t} = useTranslation(['app.plans.details', 'common']);
  const [deleteSellingPlanGroupModalOpen, setDeleteSellingPlanGroupModalOpen] =
    useState(false);
  const location = useLocation();
  const isCreate = location.pathname.includes('create');
  const form = useFormContext<{sellingPlanMode: SellingPlanModeType}>();
  const {i18n} = useTranslation();
  const locale = i18n.language;
  const productDisplayLink = `https://help.shopify.com/${locale}/manual/products/purchase-options/shopify-subscriptions/setup#display-subscriptions-on-online-store`;
  const currentSellingPlanMode =
    form.value('sellingPlanMode') || sellingPlanMode || SellingPlanMode.RECURRING;
  const planTypeCard = (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          {t('planType.title')}
        </Text>
        {isCreate ? (
          <BlockStack gap="200">
            <RadioButton
              name="sellingPlanMode"
              value={SellingPlanMode.RECURRING}
              label={t('planType.recurring')}
            />
            <RadioButton
              name="sellingPlanMode"
              value={SellingPlanMode.PREPAID}
              label={t('planType.prepaid')}
            />
          </BlockStack>
        ) : (
          <>
            <input
              type="hidden"
              name="sellingPlanMode"
              value={currentSellingPlanMode}
            />
            <Text as="p" variant="bodyMd">
              {currentSellingPlanMode === SellingPlanMode.PREPAID
                ? t('planType.prepaid')
                : t('planType.recurring')}
            </Text>
            <Text as="p" tone="subdued" variant="bodyMd">
              {t('planType.lockedHelpText')}
            </Text>
          </>
        )}
        {hasUnsupportedSellingPlans ? (
          <Banner tone="warning">
            <Text as="p" variant="bodyMd">
              {t('SubscriptionPlanForm.unsupportedSellingPlanConfiguration')}
            </Text>
          </Banner>
        ) : null}
      </BlockStack>
    </Card>
  );

  return (
    <>
      <Layout>
        <Layout.Section>
          <BlockStack gap="300">
            <Card>
              <FormLayout>
                <TextField
                  label={t('purchaseOptionTitle')}
                  name="planName"
                  helpText={
                    <Text as="p">
                      {t('purchaseOptionTitleHelpText', {
                        howToDisplayProductsLink: (
                          <Link url={productDisplayLink} target="_blank">
                            {t('purchaseOptionTitleHelpLinkText')}
                          </Link>
                        ),
                      })}
                    </Text>
                  }
                />
                <TextField
                  label={t('planTitle')}
                  name="merchantCode"
                  helpText={t('planTitleHelpText')}
                />
              </FormLayout>
            </Card>
            <ProductPickerCard
              initialSelectedProductIds={selectedProductIds}
              initialSelectedVariantIds={selectedVariantIds}
            />
            <DiscountDeliveryCard
              discountDeliveryOptions={discountDeliveryOptions}
              sellingPlanMode={currentSellingPlanMode}
            />
          </BlockStack>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <BlockStack gap="300">
            {planTypeCard}
            <SummaryCard sellingPlanMode={currentSellingPlanMode} />
          </BlockStack>
        </Layout.Section>
      </Layout>
      <Layout.Section>
        <PageActions
          primaryAction={
            <SubmitButton disabled={hasUnsupportedSellingPlans}>
              {t('actions.saveButtonText', {ns: 'common'})}
            </SubmitButton>
          }
          secondaryActions={
            !isCreate ? (
              <Button
                tone="critical"
                onClick={() => setDeleteSellingPlanGroupModalOpen(true)}
              >
                {t('deleteButtonText')}
              </Button>
            ) : undefined
          }
        />
      </Layout.Section>
      {!isCreate ? (
        <DeleteSellingPlanGroupModal
          open={deleteSellingPlanGroupModalOpen}
          onClose={() => setDeleteSellingPlanGroupModalOpen(false)}
          sellingPlanGroupName={sellingPlanGroupName}
        />
      ) : null}
    </>
  );
}
