import {
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  FormLayout,
  InlineGrid,
  Link,
  Text,
} from '@shopify/polaris';
import {useTranslation} from 'react-i18next';
import {Select} from '~/components/Select';
import {TextField} from '~/components/TextField';
import {OnFailureType, InventoryNotificationFrequencyType} from '../validator';

export function BillingFailureSettings() {
  const {t} = useTranslation('app.settings', {
    keyPrefix: 'billingFailureSettings',
  });
  const notificationsSettingsUrl = 'shopify:admin/settings/notifications/customer';

  const onFailureOptions = [
    {
      label: t('onFailure.options.skip'),
      value: OnFailureType.skip,
    },
    {
      label: t('onFailure.options.pause'),
      value: OnFailureType.pause,
    },
    {
      label: t('onFailure.options.cancel'),
      value: OnFailureType.cancel,
    },
  ];

  const staffNotificationFrequencyOptions = [
    {
      label: t('staffNotificationFrequency.options.immediately'),
      value: InventoryNotificationFrequencyType.immediately,
    },
    {
      label: t('staffNotificationFrequency.options.weekly'),
      value: InventoryNotificationFrequencyType.weekly,
    },
    {
      label: t('staffNotificationFrequency.options.monthly'),
      value: InventoryNotificationFrequencyType.monthly,
    },
  ];

  return (
    <InlineGrid columns={{xs: '1fr', md: '2fr 5fr'}} gap="400">
      <Box as="section" paddingBlockStart="400">
        <BlockStack gap="200">
          <Text as="h3" variant="headingMd">
            {t('title')}
          </Text>
          <Text as="p" variant="bodyMd">
            {t('description')}
          </Text>
        </BlockStack>
      </Box>
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingSm">
            {t('paymentFailureTitle')}
          </Text>
          <FormLayout>
            <FormLayout.Group>
              <TextField
                label={t('retryAttempts.label')}
                name="retryAttempts"
                helpText={t('retryAttempts.helpText')}
                type="number"
                min={0}
                max={10}
              />
              <TextField
                label={t('daysBetweenRetryAttempts.label')}
                name="daysBetweenRetryAttempts"
                helpText={t('daysBetweenRetryAttempts.helpText')}
                type="number"
                min={1}
                max={14}
              />
            </FormLayout.Group>
            <BlockStack gap="200">
              <Select
                label={t('onFailure.label')}
                name="onFailure"
                options={onFailureOptions}
              />
              <Text as="p" variant="bodyMd">
                <Link removeUnderline url={notificationsSettingsUrl}>
                  {t('notifications')}
                </Link>
              </Text>
            </BlockStack>
          </FormLayout>
          <>
            <Box paddingBlockStart="200" paddingBlockEnd="200">
              <Divider />
            </Box>
            <Text as="h2" variant="headingSm">
              {t('inventoryFailureTitle')}
            </Text>
            <FormLayout>
              <FormLayout.Group>
                <TextField
                  label={t('retryAttempts.label')}
                  name="inventoryRetryAttempts"
                  helpText={t('retryAttempts.helpText')}
                  type="number"
                  min={0}
                  max={10}
                />
                <TextField
                  label={t('daysBetweenRetryAttempts.label')}
                  name="inventoryDaysBetweenRetryAttempts"
                  helpText={t('daysBetweenRetryAttempts.helpText')}
                  type="number"
                  min={1}
                  max={14}
                />
              </FormLayout.Group>
              <Select
                label={t('onFailure.label')}
                name="inventoryOnFailure"
                options={onFailureOptions}
              />
              <BlockStack gap="200">
                <Select
                  label={t('staffNotificationFrequency.label')}
                  name="inventoryNotificationFrequency"
                  options={staffNotificationFrequencyOptions}
                />
                <Text as="p" variant="bodyMd">
                  <Link removeUnderline url={notificationsSettingsUrl}>
                    {t('notifications')}
                  </Link>
                </Text>
              </BlockStack>
            </FormLayout>
          </>
        </BlockStack>
      </Card>
    </InlineGrid>
  );
}

export function SubscriptionNotificationsSettings() {
  const {t} = useTranslation('app.settings', {
    keyPrefix: 'billingFailureSettings',
  });
  const notificationsSettingsUrl = 'shopify:admin/settings/notifications/customer';

  return (
    <InlineGrid columns={{xs: '1fr', md: '2fr 5fr'}} gap="400">
      <Box as="section" paddingBlockStart="400">
        <Text as="h3" variant="headingMd">
          {t('subscriptionNotifications.title', {
            defaultValue: 'Subscription notifications',
          })}
        </Text>
      </Box>
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingSm">
            {t('subscriptionNotifications.customizeTitle', {
              defaultValue: 'Customize notifications',
            })}
          </Text>
          <Text as="p" variant="bodyMd">
            {t('subscriptionNotifications.description', {
              defaultValue:
                'Modify your emails in the subscription section to create unique communication for you and your customers. Decide which subscription notification emails you want to receive and which ones you want to send to your customers.',
            })}
          </Text>
          <Box>
            <Button
              url={notificationsSettingsUrl}
              variant="secondary"
              accessibilityLabel={t('subscriptionNotifications.viewNotifications', {
                defaultValue: 'View notifications',
              })}
            >
              {t('subscriptionNotifications.viewNotifications', {
                defaultValue: 'View notifications',
              })}
            </Button>
          </Box>
        </BlockStack>
      </Card>
    </InlineGrid>
  );
}
