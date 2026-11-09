import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { useDataStore, whenSaved } from '@/db/dataStore';
import { App } from './App';
import { useUiStore } from './store';

const initialUi = useUiStore.getState();

beforeEach(async () => {
  await db.delete();
  await db.open();
  useDataStore.setState({ loaded: false, goals: [], steps: [] });
  useUiStore.setState(initialUi, true);
  localStorage.clear();
});

afterEach(async () => {
  await act(() => whenSaved());
});

/** The outline as indented text, e.g. "A\n  A1". */
function outlineText(): string {
  return screen
    .queryAllByRole('treeitem')
    .map(
      (el) =>
        `${'  '.repeat(Number(el.getAttribute('aria-level')) - 1)}${el.getAttribute('aria-label')}`,
    )
    .join('\n');
}

async function createGoal(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
  deadline?: string,
) {
  await user.click(await screen.findByRole('button', { name: 'New goal' }));
  await user.type(screen.getByLabelText('Title'), title);
  if (deadline) await user.type(screen.getByLabelText('Deadline'), deadline);
  await user.click(screen.getByRole('button', { name: 'Create goal' }));
  await screen.findByRole('heading', { name: title });
}

describe('App', () => {
  it('shows an empty state before any goal exists', async () => {
    render(<App />);
    expect(await screen.findByText('Nothing planned yet.')).toBeInTheDocument();
  });

  it('creates a goal with a deadline and shows the countdown', async () => {
    const user = userEvent.setup();
    render(<App />);
    await createGoal(user, 'Thesis', '2099-01-01');
    expect(screen.getByText(/days left/)).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Goal list' });
    expect(within(list).getByText('Thesis')).toBeInTheDocument();
    expect(within(list).getByText(/^0% · \d+d$/)).toBeInTheDocument();
  });

  it('builds a tree with Enter, Tab and Shift+Tab and saves it with outbox entries', async () => {
    const user = userEvent.setup();
    render(<App />);
    await createGoal(user, 'Thesis');

    await user.click(screen.getByRole('button', { name: 'Add step' }));
    await user.keyboard('Literature review{Enter}');
    await user.keyboard('{Tab}Find sources{Enter}');
    await user.keyboard('{Tab}Search Scopus{Enter}');
    await user.keyboard('Ask supervisor{Enter}');
    await user.keyboard('{Shift>}{Tab}{/Shift}{Shift>}{Tab}{/Shift}Methodology{Enter}');
    await user.keyboard('{Enter}'); // empty step ends quick entry

    expect(outlineText()).toBe(
      [
        'Literature review',
        '  Find sources',
        '    Search Scopus',
        '    Ask supervisor',
        'Methodology',
      ].join('\n'),
    );

    await act(() => whenSaved());
    const stored = await db.steps.toArray();
    expect(
      stored
        .filter((s) => !s.deleted)
        .map((s) => s.title)
        .sort(),
    ).toEqual([
      'Ask supervisor',
      'Find sources',
      'Literature review',
      'Methodology',
      'Search Scopus',
    ]);
    const outbox = await db.outbox.toArray();
    expect(outbox.filter((e) => e.table === 'steps')).toHaveLength(stored.length);
    expect(outbox.filter((e) => e.table === 'goals')).toHaveLength(1);
  });

  it('navigates with arrows, completes with Space and auto-completes the parent', async () => {
    const user = userEvent.setup();
    render(<App />);
    await createGoal(user, 'Exam');
    await user.click(screen.getByRole('button', { name: 'Add step' }));
    await user.keyboard('Revise{Enter}{Tab}Chapter 1{Enter}Chapter 2{Escape}');

    // Escape leaves edit mode with "Chapter 2" focused.
    expect(document.activeElement).toHaveAttribute('aria-label', 'Chapter 2');
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toHaveAttribute('aria-label', 'Chapter 1');

    await user.keyboard(' ');
    expect(outlineText()).toBe('Revise\n  Chapter 2');
    expect(screen.getByRole('progressbar', { name: 'Exam progress' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    // Focus moved to the next row; completing it finishes the branch.
    expect(document.activeElement).toHaveAttribute('aria-label', 'Chapter 2');
    await user.keyboard(' ');
    expect(outlineText()).toBe('');
    expect(screen.getByText('Everything here is done. 🎉')).toBeInTheDocument();

    await user.click(screen.getByLabelText(/Show completed/));
    expect(outlineText()).toBe('Revise\n  Chapter 1\n  Chapter 2');
  });

  it('asks before completing a step with open sub-steps', async () => {
    const user = userEvent.setup();
    render(<App />);
    await createGoal(user, 'Exam');
    await user.click(screen.getByRole('button', { name: 'Add step' }));
    await user.keyboard('Revise{Enter}{Tab}Chapter 1{Enter}Chapter 2{Escape}');
    await user.keyboard('{ArrowUp}{ArrowUp}'); // → Revise

    await user.keyboard(' ');
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Mark all 2 remaining steps done?');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(outlineText()).toBe('Revise\n  Chapter 1\n  Chapter 2');

    const revise = screen.getByRole('treeitem', { name: 'Revise' });
    await user.click(within(revise).getByRole('checkbox', { name: 'Mark as done' }));
    await user.click(await screen.findByRole('button', { name: 'Mark all done' }));
    await waitFor(() => expect(outlineText()).toBe(''));
  });

  it('edits a title by clicking it and removes empty steps when leaving edit mode', async () => {
    const user = userEvent.setup();
    render(<App />);
    await createGoal(user, 'Thesis');
    await user.click(screen.getByRole('button', { name: 'Add step' }));
    await user.keyboard('Draft{Enter}{Escape}');
    // The empty step created by Enter was removed on Escape.
    expect(outlineText()).toBe('Draft');

    await user.click(screen.getByText('Draft'));
    await user.keyboard(' introduction{Escape}');
    expect(outlineText()).toBe('Draft introduction');
  });

  it('collapses and expands with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<App />);
    await createGoal(user, 'Thesis');
    await user.click(screen.getByRole('button', { name: 'Add step' }));
    await user.keyboard('Parent{Enter}{Tab}Child{Escape}{ArrowUp}');
    await user.keyboard('{ArrowLeft}');
    expect(outlineText()).toBe('Parent');
    expect(screen.getByText('1 open')).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(outlineText()).toBe('Parent\n  Child');
  });

  it('moves a step among its siblings with Alt+Arrow', async () => {
    const user = userEvent.setup();
    render(<App />);
    await createGoal(user, 'Thesis');
    await user.click(screen.getByRole('button', { name: 'Add step' }));
    await user.keyboard('One{Enter}Two{Enter}Three{Escape}');
    await user.keyboard('{Alt>}{ArrowUp}{ArrowUp}{/Alt}');
    expect(outlineText()).toBe('Three\nOne\nTwo');
  });

  it('deletes a step with its sub-steps after confirming', async () => {
    const user = userEvent.setup();
    render(<App />);
    await createGoal(user, 'Thesis');
    await user.click(screen.getByRole('button', { name: 'Add step' }));
    await user.keyboard('Parent{Enter}{Tab}Child{Enter}{Shift>}{Tab}{/Shift}Other{Escape}');
    await user.keyboard('{ArrowUp}{ArrowUp}{Delete}');
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(outlineText()).toBe('Other'));
  });

  it('archives a goal from the header menu', async () => {
    const user = userEvent.setup();
    render(<App />);
    await createGoal(user, 'Old course');
    await user.click(screen.getByRole('button', { name: 'Goal actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Archive' }));
    const list = screen.getByRole('list', { name: 'Goal list' });
    await waitFor(() => expect(within(list).queryByText('Old course')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Show archived (1)' }));
    expect(within(list).getByText('Old course')).toBeInTheDocument();
  });

  describe('completion feedback and the Completed feed', () => {
    async function setUp(user: ReturnType<typeof userEvent.setup>) {
      render(<App />);
      await createGoal(user, 'Thesis');
      await user.click(screen.getByRole('button', { name: 'Add step' }));
      await user.keyboard('Lit review{Enter}{Tab}Paper A{Enter}Paper B{Escape}');
    }
    const feed = () => screen.getByRole('region', { name: 'Completed' });
    const toast = () => screen.getByRole('status', { name: 'Notifications' });
    const check = (name: string) =>
      within(screen.getByRole('treeitem', { name })).getByRole('checkbox');

    it('lists a completed step under Today with its breadcrumb', async () => {
      const user = userEvent.setup();
      await setUp(user);
      expect(within(feed()).getByText(/Finished steps collect here/)).toBeInTheDocument();

      await user.click(check('Paper A'));
      expect(within(feed()).getByText('Today')).toBeInTheDocument();
      expect(within(feed()).getByText('Paper A')).toBeInTheDocument();
      expect(within(feed()).getByText('Thesis › Lit review')).toBeInTheDocument();
      expect(within(feed()).getByText('1 today')).toBeInTheDocument();
      expect(toast()).toHaveTextContent('Done: Paper A');
    });

    it('undo in the toast reopens the step', async () => {
      const user = userEvent.setup();
      await setUp(user);
      await user.click(check('Paper A'));
      await user.click(within(toast()).getByRole('button', { name: 'Undo' }));
      await waitFor(() => expect(outlineText()).toBe('Lit review\n  Paper A\n  Paper B'));
      expect(within(feed()).queryByText('Paper A')).not.toBeInTheDocument();
    });

    it('celebrates a finished branch, and undo from the feed restores it', async () => {
      const user = userEvent.setup();
      await setUp(user);
      await user.click(check('Paper A'));
      await user.click(check('Paper B'));
      expect(toast()).toHaveTextContent('Branch finished: Lit review');

      // The finished branch is listed above the step that finished it.
      const titles = within(feed())
        .getAllByRole('listitem')
        .map((li) => li.querySelector('span.truncate')?.textContent);
      expect(titles.slice(0, 2)).toEqual(['Lit review', 'Paper B']);

      await user.click(within(feed()).getByRole('button', { name: 'Undo "Paper B"' }));
      await waitFor(() => expect(outlineText()).toBe('Lit review\n  Paper B'));
      expect(within(feed()).getAllByRole('listitem')).toHaveLength(1);
    });

    it('filters the feed to the current goal', async () => {
      const user = userEvent.setup();
      await setUp(user);
      await user.click(check('Paper A'));
      await createGoal(user, 'Exam');
      await user.click(within(feed()).getByRole('radio', { name: 'This goal' }));
      expect(within(feed()).queryByText('Paper A')).not.toBeInTheDocument();
      await user.click(within(feed()).getByRole('radio', { name: 'All goals' }));
      expect(within(feed()).getByText('Paper A')).toBeInTheDocument();
    });

    it('fades a completed step out of the outline', async () => {
      const user = userEvent.setup();
      await setUp(user);
      await user.click(check('Paper A'));
      // Hidden from assistive tech at once, removed after the animation.
      expect(outlineText()).toBe('Lit review\n  Paper B');
      expect(document.querySelector('.step-leave')).not.toBeNull();
      await waitFor(() => expect(document.querySelector('.step-leave')).toBeNull(), {
        timeout: 2000,
      });
    });
  });
});
