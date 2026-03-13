import {List} from '~/components/polaris';
import {useTranslation} from 'react-i18next';
import {useFormContext} from '@rvf/remix';
import {useShopInfo} from '~/context/ShopContext';
import type {
  DiscountDeliveryOption,
  DiscountTypeType,
  SellingPlanModeType,
} from '~/routes/app.plans.$id/validator';
import {DiscountType, SellingPlanMode} from '~/routes/app.plans.$id/validator';
import {formatPrice} from '~/utils/helpers/money';
import {DeliveryFrequencyInterval} from '~/utils/helpers/zod';

export function DeliverySummary({
  sellingPlanMode,
}: {
  sellingPlanMode: SellingPlanModeType;
}) {
  const {t, i18n} = useTranslation('app.plans.details');
  const locale = i18n.language;
  const {currencyCode: shopCurrencyCode} = useShopInfo();
  const form = useFormContext<{
    discountType: DiscountTypeType;
    offerDiscount: string;
    discountDeliveryOptions: DiscountDeliveryOption[];
  }>();

  const discountDeliveryOptions = form.value('discountDeliveryOptions');
  let deliveryFrequencyText = '';

  if (
    discountDeliveryOptions.length === 1 &&
    !discountDeliveryOptions[0].deliveryFrequency
  ) {
    return;
  }

  if (discountDeliveryOptions.length === 1) {
    const {
      deliveryFrequency,
      deliveryInterval,
      discountValue,
      prepaidDeliveriesCount,
    } =
      discountDeliveryOptions[0];
    let discountText = '';

    const deliveryTranslationKey = (() => {
      switch (deliveryInterval) {
        case DeliveryFrequencyInterval.Month:
          return 'summaryCard.monthlyDelivery';
        case DeliveryFrequencyInterval.Year:
          return 'summaryCard.yearlyDelivery';
        default:
          return 'summaryCard.weeklyDelivery';
      }
    })();

    const deliveryText = t(deliveryTranslationKey, {
      count: Number(deliveryFrequency),
      intervalCount: deliveryFrequency,
    });
    const prepaidText =
      sellingPlanMode === SellingPlanMode.PREPAID && prepaidDeliveriesCount
        ? t('summaryCard.prepaidDelivery', {
            deliveryText,
            count: prepaidDeliveriesCount,
          })
        : deliveryText;

    if (discountValue && form.value('offerDiscount')) {
      switch (form.value('discountType')) {
        case DiscountType.FIXED_AMOUNT:
          discountText = t('summaryCard.amountOff', {
            amount: formatPrice({
              currency: shopCurrencyCode,
              amount: discountValue,
              locale,
            }),
          });
          break;
        case DiscountType.PERCENTAGE:
          discountText = t('summaryCard.percentageOff', {
            amount: discountValue,
          });
          break;
        case DiscountType.PRICE:
          discountText = t('summaryCard.fixedPrice', {
            amount: formatPrice({
              currency: shopCurrencyCode,
              amount: discountValue,
              locale,
            }),
          });
          break;
        default:
          break;
      }
    }

    deliveryFrequencyText = discountText
      ? t('summaryCard.deliveryFrequenciesWithDiscount', {
          deliveryText: prepaidText,
          discountText,
        })
      : prepaidText;
  } else {
    deliveryFrequencyText =
      sellingPlanMode === SellingPlanMode.PREPAID
        ? t('summaryCard.multiplePrepaidOptions', {
            count: discountDeliveryOptions.length,
          })
        : t('summaryCard.multipleDeliveryFrequencies', {
            count: discountDeliveryOptions.length,
          });
  }

  return <List.Item>{deliveryFrequencyText}</List.Item>;
}
