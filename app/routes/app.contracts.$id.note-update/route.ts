import {
  data, type ActionFunctionArgs,
} from 'react-router';
import {composeGid} from '@shopify/admin-graphql-api-utilities';
import i18n from '~/i18n/i18n.server';
import {buildDraftFromContract} from '~/models/SubscriptionContractDraft/SubscriptionContractDraft.server';
import {authenticate} from '~/shopify.server';
import type {TypedResponse, WithToast} from '~/types';
import {toast} from '~/utils/toast';

export async function action({
  request,
  params,
}: ActionFunctionArgs): Promise<TypedResponse<WithToast<{error?: boolean}>>> {
  const t = await i18n.getFixedT(request, 'app.contracts');
  const body = await request.formData();
  const {admin, session} = await authenticate.admin(request);
  const shopDomain = session.shop;
  const contractId = composeGid('SubscriptionContract', params.id || '');

  const note = ((body.get('note') as string | null) || '').trim().slice(0, 5000);

  const updateNoteError = data({
    error: true,
    ...toast(
      t('notesCard.errorMessage', {
        defaultValue: 'Unable to update note',
      }),
      {isError: true},
    ),
  });

  try {
    const draft = await buildDraftFromContract(
      shopDomain,
      contractId,
      admin.graphql,
    );

    const result = await draft.updateNote(note === '' ? null : note);

    if (!result) {
      return updateNoteError;
    }

    const draftCommitted = await draft.commit();

    if (!draftCommitted) {
      return updateNoteError;
    }

    return data(
      toast(
        t('notesCard.successMessage', {
          defaultValue: 'Note updated',
        }),
      ),
    );
  } catch {
    return updateNoteError;
  }
}
