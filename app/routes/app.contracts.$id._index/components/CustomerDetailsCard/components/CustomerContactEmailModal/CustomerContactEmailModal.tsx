import type {FetcherWithComponents} from 'react-router';
import {useFetcher} from 'react-router';
import {Modal, TitleBar} from '@shopify/app-bridge-react';
import {BlockStack, Box, Checkbox, TextField} from '@shopify/polaris';
import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useToasts} from '~/hooks';
import type {WithToast} from '~/types';

export interface CustomerContactEmailModalProps {
  open: boolean;
  onClose: () => void;
  customerEmail: string;
  customerId: string;
}

export function CustomerContactEmailModal({
  open,
  onClose,
  customerEmail,
  customerId,
}: CustomerContactEmailModalProps) {
  const {t} = useTranslation('app.contracts');
  const {showToasts} = useToasts();

  const [email, setEmail] = useState(customerEmail);
  const [updateProfile, setUpdateProfile] = useState(true);

  const fetcher: FetcherWithComponents<WithToast<{error?: boolean}>> =
    useFetcher();

  const isLoadingOrSubmitting =
    fetcher.state === 'loading' || fetcher.state === 'submitting';

  useEffect(() => {
    if (open) {
      setEmail(customerEmail);
      setUpdateProfile(true);
    }
  }, [open, customerEmail]);

  useEffect(() => {
    if (!isLoadingOrSubmitting) {
      showToasts(fetcher.data);

      if (fetcher.data && !fetcher.data.error) {
        onClose();
      }

      fetcher.data = undefined;
    }
  }, [fetcher, fetcher.data, isLoadingOrSubmitting, onClose, showToasts]);

  const hasChanged = email !== customerEmail;
  const isValidEmail = email.length > 0 && email.includes('@');

  async function updateEmail() {
    const formData = new FormData();
    formData.append('email', email);
    formData.append('customerId', customerId);
    formData.append('updateProfile', updateProfile ? 'true' : 'false');

    fetcher.submit(formData, {method: 'post', action: './email-update'});
  }

  return (
    <Modal open={open} onHide={onClose}>
      <Box padding="400">
        <BlockStack gap="400">
          <TextField
            label={t('customerDetails.emailModal.emailLabel')}
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="off"
          />
          <Checkbox
            label={t('customerDetails.emailModal.updateProfile')}
            checked={updateProfile}
            onChange={setUpdateProfile}
          />
        </BlockStack>
      </Box>
      <TitleBar title={t('customerDetails.emailModal.title')}>
        <button onClick={onClose}>
          {t('customerDetails.emailModal.actions.cancel')}
        </button>
        <button
          variant="primary"
          loading={isLoadingOrSubmitting ? '' : undefined}
          disabled={!hasChanged || !isValidEmail}
          onClick={updateEmail}
        >
          {t('customerDetails.emailModal.actions.done')}
        </button>
      </TitleBar>
    </Modal>
  );
}
