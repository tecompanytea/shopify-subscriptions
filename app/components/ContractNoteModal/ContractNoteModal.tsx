import {Modal, TitleBar} from '@shopify/app-bridge-react';
import {BlockStack, Box, InlineStack, Text} from '~/components/polaris';

const STextArea: any = 's-text-area';

export interface ContractNoteModalProps {
  open: boolean;
  initialValue?: string | null;
  value: string;
  onValueChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  title: string;
  label: string;
  details: string;
  placeholder: string;
  cancelText: string;
  doneText: string;
  isSaving?: boolean;
}

export function ContractNoteModal({
  open,
  initialValue,
  value,
  onValueChange,
  onClose,
  onSave,
  title,
  label,
  details,
  placeholder,
  cancelText,
  doneText,
  isSaving = false,
}: ContractNoteModalProps) {
  const trimmedInitialValue = (initialValue ?? '').trim();
  const trimmedValue = value.trim();
  const hasChanged = trimmedInitialValue !== trimmedValue;
  const canSave =
    hasChanged && (trimmedValue !== '' || trimmedInitialValue !== '');

  return (
    <Modal open={open} onHide={onClose}>
      <Box padding="300">
        <BlockStack gap="300">
          <BlockStack gap="100">
            <STextArea
              label={label}
              rows={3}
              details={details}
              placeholder={placeholder}
              autocomplete="off"
              value={value}
              onInput={(event: any) =>
                onValueChange(
                  String(
                    event?.detail?.value ?? event?.currentTarget?.value ?? '',
                  ).slice(0, 5000),
                )
              }
            />
            <InlineStack align="end">
              <Text as="p" variant="bodySm" tone="subdued">
                {`${value.length}/5000`}
              </Text>
            </InlineStack>
          </BlockStack>
        </BlockStack>
      </Box>
      <TitleBar title={title}>
        <button onClick={onClose}>{cancelText}</button>
        <button
          variant="primary"
          loading={isSaving ? '' : undefined}
          disabled={!canSave}
          onClick={onSave}
        >
          {doneText}
        </button>
      </TitleBar>
    </Modal>
  );
}
