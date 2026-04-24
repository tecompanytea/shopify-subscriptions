import {parseGid} from '@shopify/admin-graphql-api-utilities';
import {
  ActionList,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Link,
  Popover,
  Text,
} from '~/components/polaris';
import {EditIcon} from '~/components/polaris-icons';
import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Address} from '~/components/Address/Address';
import type {Customer, SubscriptionDeliveryMethod} from '~/types/contracts';
import {getMobileSafeProtocolURL} from '~/utils/getMobileSafeProtocolURL';
import {formatCustomerAddress} from '~/utils/helpers/contracts';
import {
  deliveryMethodIsLocalDelivery,
  deliveryMethodIsLocalPickup,
  deliveryMethodIsShipping,
} from '~/utils/typeGuards/contracts';
import {CustomerAddressModal} from './components/CustomerAddressModal/CustomerAddressModal';
import {CustomerContactEmailModal} from './components/CustomerContactEmailModal/CustomerContactEmailModal';

export interface CustomerDetailsCardProps {
  customer: Customer;
  deliveryMethod?: SubscriptionDeliveryMethod;
}

export function CustomerDetailsCard({
  customer,
  deliveryMethod,
}: CustomerDetailsCardProps) {
  const {t} = useTranslation('app.contracts');
  const [menuOpen, setMenuOpen] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const {id, displayName, email, addresses} = customer;

  const formattedAddress = (() => {
    if (!deliveryMethod) {
      return null;
    }

    if (deliveryMethodIsShipping(deliveryMethod)) {
      return formatCustomerAddress(deliveryMethod.address);
    }

    if (deliveryMethodIsLocalDelivery(deliveryMethod)) {
      return formatCustomerAddress({
        ...deliveryMethod.address,
        phone: deliveryMethod.localDeliveryOption.phone,
      });
    }

    if (deliveryMethodIsLocalPickup(deliveryMethod)) {
      return null;
    }
  })();

  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd" fontWeight="semibold">
            {t('customerDetails.title')}
          </Text>
          <Link
            removeUnderline
            target="_parent"
            url={`shopify:admin/customers/${parseGid(id)}`}
          >
            <Text as="p" variant="bodyMd">
              {displayName}
            </Text>
          </Link>
        </BlockStack>
        {email ? (
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd" fontWeight="semibold">
                {t('customerDetails.contactInformation')}
              </Text>
              <Button
                variant="plain"
                icon={EditIcon}
                onClick={() => setEmailModalOpen(true)}
              />
            </InlineStack>
            <Link
              removeUnderline
              target="_parent"
              url={`shopify:admin/customers/${parseGid(id)}`}
            >
              <Text as="p" variant="bodyMd">
                {email}
              </Text>
            </Link>
            <CustomerContactEmailModal
              open={emailModalOpen}
              onClose={() => setEmailModalOpen(false)}
              customerEmail={email}
              customerId={id}
            />
          </BlockStack>
        ) : null}
        {formattedAddress ? (
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd" fontWeight="semibold">
                {t('customerDetails.shippingAddress')}
              </Text>
              <Popover
                active={menuOpen}
                activator={
                  <Button
                    variant="plain"
                    icon={EditIcon}
                    onClick={() => setMenuOpen((active) => !active)}
                  />
                }
                autofocusTarget="first-node"
                onClose={() => setMenuOpen(false)}
              >
                <ActionList
                  actionRole="menuitem"
                  items={[
                    {
                      content: t('customerDetails.actions.selectAddress'),
                      onAction: () => setAddressModalOpen(true),
                      disabled: addresses.length === 0,
                    },
                    {
                      content: t('customerDetails.actions.manageAddress'),
                      onAction: () => {
                        open(
                          getMobileSafeProtocolURL(
                            `shopify:admin/customers/${parseGid(id)}`,
                          ),
                          '_top',
                        );
                      },
                    },
                  ]}
                />
              </Popover>
            </InlineStack>
            <Address address={formattedAddress} />
            <CustomerAddressModal
              open={addressModalOpen}
              onClose={() => setAddressModalOpen(false)}
              currentContractAddress={formattedAddress}
              customerAddresses={addresses}
              deliveryMethodName={deliveryMethod?.name}
              customerId={id}
            />
          </BlockStack>
        ) : null}
      </BlockStack>
    </Card>
  );
}
