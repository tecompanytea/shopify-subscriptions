import type {FetcherWithComponents} from '@remix-run/react';
import {useFetcher} from '@remix-run/react';
import {BlockStack, Button, Card, InlineStack, Text} from '@shopify/polaris';
import {EditIcon} from '@shopify/polaris-icons';
import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ContractNoteModal} from '~/components/ContractNoteModal/ContractNoteModal';
import {useToasts} from '~/hooks';
import type {WithToast} from '~/types';

export interface ContractNotesCardProps {
  note?: string | null;
}

export function ContractNotesCard({note}: ContractNotesCardProps) {
  const {t} = useTranslation('app.contracts');
  const {showToasts} = useToasts();
  const [modalOpen, setModalOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(note ?? '');

  const fetcher: FetcherWithComponents<WithToast<{error?: boolean}>> =
    useFetcher();

  const isLoadingOrSubmitting =
    fetcher.state === 'loading' || fetcher.state === 'submitting';

  useEffect(() => {
    if (modalOpen) {
      setNoteDraft(note ?? '');
    }
  }, [modalOpen, note]);

  useEffect(() => {
    if (!isLoadingOrSubmitting) {
      showToasts(fetcher.data);

      if (fetcher.data && !fetcher.data.error) {
        setModalOpen(false);
      }

      fetcher.data = undefined;
    }
  }, [fetcher, fetcher.data, isLoadingOrSubmitting, showToasts]);

  const trimmedCurrentNote = (note ?? '').trim();

  function updateNote() {
    const formData = new FormData();
    formData.append('note', noteDraft);

    fetcher.submit(formData, {method: 'post', action: './note-update'});
  }

  return (
    <>
      <Card>
        <BlockStack gap="200">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h2" variant="headingMd" fontWeight="semibold">
              {t('notesCard.title', {defaultValue: 'Notes'})}
            </Text>
            <Button
              variant="plain"
              icon={EditIcon}
              onClick={() => setModalOpen(true)}
              accessibilityLabel={t('notesCard.edit', {
                defaultValue: 'Edit note',
              })}
            />
          </InlineStack>
          {trimmedCurrentNote ? (
            <div
              data-testid="contract-note-content"
              style={{whiteSpace: 'pre-wrap'}}
            >
              <Text as="span" breakWord>
                {trimmedCurrentNote}
              </Text>
            </div>
          ) : (
            <Text as="p" tone="subdued">
              {t('notesCard.empty', {defaultValue: 'No notes'})}
            </Text>
          )}
        </BlockStack>
      </Card>
      <ContractNoteModal
        open={modalOpen}
        initialValue={note}
        value={noteDraft}
        onValueChange={setNoteDraft}
        onClose={() => setModalOpen(false)}
        onSave={updateNote}
        isSaving={isLoadingOrSubmitting}
        title={t('notesCard.modalTitle', {defaultValue: 'Edit note'})}
        label={t('notesCard.label', {defaultValue: 'Notes'})}
        details={t('manualCreate.notes.helper', {
          defaultValue:
            'To comment on a draft order or mention a staff member, use Timeline instead',
        })}
        placeholder={t('manualCreate.notes.placeholder', {
          defaultValue: 'Add note',
        })}
        cancelText={t('notesCard.cancel', {defaultValue: 'Cancel'})}
        doneText={t('notesCard.done', {defaultValue: 'Done'})}
      />
    </>
  );
}
