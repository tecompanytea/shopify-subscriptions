import {
  json,
  type TypedResponse,
  type ActionFunctionArgs,
} from '@remix-run/node';
import {composeGid} from '@shopify/admin-graphql-api-utilities';
import i18n from '~/i18n/i18next.server';
import {buildDraftFromContract} from '~/models/SubscriptionContractDraft/SubscriptionContractDraft.server';
import {authenticate} from '~/shopify.server';
import type {WithToast} from '~/types';
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

  const updateNoteError = json({
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

    return json(
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
