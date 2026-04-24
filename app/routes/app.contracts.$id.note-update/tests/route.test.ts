import {composeGid} from '@shopify/admin-graphql-api-utilities';
import {describe, expect, it} from 'vitest';
import {mockShopifyServer} from '#/test-utils';
import {action} from '../route';
import SubscriptionContractDraftCommitMutation from '~/graphql/SubscriptionContractDraftCommitMutation';
import SubscriptionContractDraftUpdateMutation from '~/graphql/SubscriptionContractDraftUpdateMutation';
import {createMockGraphQLResponse} from '../../app.contracts.$id._index/tests/Fixtures';

const {graphQL, mockGraphQL} = mockShopifyServer();

const mockDraftId = composeGid('SubscriptionContractDraft', 1);

const defaultGraphQLResponses = createMockGraphQLResponse({
  SubscriptionContractUpdate: {
    data: {
      subscriptionContractUpdate: {
        draft: {
          id: mockDraftId,
        },
        userErrors: [],
      },
    },
  },
  SubscriptionDraftUpdate: {
    data: {
      subscriptionDraftUpdate: {
        draft: {
          id: mockDraftId,
        },
        userErrors: [],
      },
    },
  },
  SubscriptionContractDraftDiscounts: {
    data: {
      subscriptionDraft: {
        discounts: {
          edges: [],
        },
      },
    },
  },
  SubscriptionDraftCommit: {
    data: {
      subscriptionDraftCommit: {
        contract: {
          id: composeGid('SubscriptionContract', 1),
        },
        userErrors: [],
      },
    },
  },
});

function createActionRequest(note: string) {
  const formData = new FormData();
  formData.append('note', note);

  return {
    request: new Request('https://example.com/app/contracts/1/note-update', {
      method: 'POST',
      body: formData,
    }),
    params: {
      id: '1',
    },
    context: {},
  };
}

describe('app.contracts.$id.note-update action', () => {
  it('updates the contract note', async () => {
    mockGraphQL(defaultGraphQLResponses);

    const response = await action(createActionRequest('Updated note'));

    expect(response.status).toBe(200);
    expect(graphQL).toHavePerformedGraphQLOperation(
      SubscriptionContractDraftUpdateMutation,
      {
        variables: {
          draftId: mockDraftId,
          input: {
            note: 'Updated note',
          },
        },
      },
    );
    expect(graphQL).toHavePerformedGraphQLOperation(
      SubscriptionContractDraftCommitMutation,
      {
        variables: {
          draftId: mockDraftId,
        },
      },
    );
  });

  it('clears the contract note', async () => {
    mockGraphQL(defaultGraphQLResponses);

    const response = await action(createActionRequest(''));

    expect(response.status).toBe(200);
    expect(graphQL).toHavePerformedGraphQLOperation(
      SubscriptionContractDraftUpdateMutation,
      {
        variables: {
          draftId: mockDraftId,
          input: {
            note: null,
          },
        },
      },
    );
  });
});
