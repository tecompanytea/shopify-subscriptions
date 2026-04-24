import {
  BlockStack,
  Button,
  Card,
  InlineStack,
  Text,
} from '~/components/polaris';
import {EditIcon} from '~/components/polaris-icons';
import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import PaymentIcon from '~/components/PaymentIcon/PaymentIcon';
import type {Customer, CustomerPaymentMethod} from '~/types/contracts';
import {
  formatExpirationDate,
  formatPaymentBrandName,
  getPaymentInstrumentIconBrand,
  paymentInstrumentIsCreditCard,
  paymentInstrumentIsPaypal,
  paymentInstrumentIsShopPay,
} from '~/utils/helpers/paymentMethods';
import {CustomerPaymentMethodEmailModal} from './components/CustomerPaymentMethodEmailModal/CustomerPaymentMethodEmailModal';
import {useFormatDate} from '~/utils/helpers/date';

interface CustomerPaymentMethodDetailsCardProps {
  customerPaymentMethod: CustomerPaymentMethod;
  customer: Customer;
}

export function CustomerPaymentMethodDetailsCard({
  customer,
  customerPaymentMethod,
}: CustomerPaymentMethodDetailsCardProps) {
  const {t, i18n} = useTranslation('app.contracts');
  const formatDate = useFormatDate();
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const {instrument} = customerPaymentMethod;

  if (!instrument) {
    return null;
  }

  const paymentMethodText = (() => {
    if (paymentInstrumentIsPaypal(instrument)) {
      return instrument.paypalAccountEmail;
    }

    if (paymentInstrumentIsCreditCard(instrument)) {
      const brand = formatPaymentBrandName(instrument.brand);
      const paymentBrandText = t(
        `paymentMethodDetails.paymentInstrumentBrands.${brand}`,
        '',
      );
      return `${paymentBrandText} ${instrument.maskedNumber}`;
    }

    if (paymentInstrumentIsShopPay(instrument)) {
      return `${instrument.maskedNumber}`;
    }

    throw new Error('Invalid payment instrument');
  })();

  const expirationDateText = (() => {
    if (
      paymentInstrumentIsCreditCard(instrument) ||
      paymentInstrumentIsShopPay(instrument)
    ) {
      return formatExpirationDate(
        instrument.expiryMonth,
        instrument.expiryYear,
        t,
      );
    }

    return null;
  })();

  return (
    <>
      <Card>
        <BlockStack gap="300">
          {customerPaymentMethod.revokedAt == null ? (
            <>
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd" fontWeight="semibold">
                  {t('paymentMethodDetails.title')}
                </Text>
                <Button
                  variant="plain"
                  icon={EditIcon}
                  onClick={() => setEmailModalOpen(true)}
                />
              </InlineStack>
              <BlockStack gap="200">
                <InlineStack gap="200" blockAlign="center">
                  <PaymentIcon
                    brand={getPaymentInstrumentIconBrand(instrument)}
                  />
                  <Text as="span" variant="bodyMd">
                    {paymentMethodText}
                  </Text>
                </InlineStack>
                {expirationDateText ? (
                  <Text as="span" variant="bodyMd" tone="subdued">
                    {expirationDateText}
                  </Text>
                ) : null}
              </BlockStack>
            </>
          ) : (
            <>
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd" fontWeight="semibold">
                  {t('paymentMethodDetails.title')}
                </Text>
              </InlineStack>
              <BlockStack gap="200">
                <Text as="span" variant="bodyMd">
                  <Text as="span" variant="bodyMd" tone="subdued">
                    {t('paymentMethodDetails.revoked', {
                      revokedAt: formatDate(
                        customerPaymentMethod.revokedAt,
                        i18n.language,
                      ),
                    })}
                  </Text>
                </Text>
              </BlockStack>
            </>
          )}
        </BlockStack>
      </Card>
      {customer.email ? (
        <CustomerPaymentMethodEmailModal
          open={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
          instrument={instrument}
          customerEmail={customer.email}
          customerDisplayName={customer.displayName || ''}
        />
      ) : null}
    </>
  );
}
