import {mountRemixStubWithAppContext} from '#/test-utils';
import {screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {ContractNotesCard} from '../ContractNotesCard';

async function mountContractNotesCard(note: string | null = null) {
  mountRemixStubWithAppContext({
    routes: [
      {
        path: `/app/contracts/:id`,
        Component: () => <ContractNotesCard note={note} />,
      },
    ],
    remixStubProps: {
      initialEntries: ['/app/contracts/1'],
    },
  });

  return await screen.findByText('Notes');
}

describe('ContractNotesCard', () => {
  it('displays empty state when there is no note', async () => {
    await mountContractNotesCard();

    expect(screen.getByText('No notes')).toBeInTheDocument();
  });

  it('displays the existing note', async () => {
    await mountContractNotesCard('Line 1\nLine 2');

    const noteContent = screen.getByTestId('contract-note-content');

    expect(noteContent.textContent).toBe('Line 1\nLine 2');
    expect(noteContent).toHaveStyle({
      whiteSpace: 'pre-wrap',
    });
  });
});
