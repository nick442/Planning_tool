import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App shell', () => {
  it('renders the demo goal outline with completed steps hidden', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Thesis' })).toBeInTheDocument();
    const outline = screen.getByRole('list', { name: 'Outline' });
    expect(within(outline).getByText('Ask supervisor for key refs')).toBeInTheDocument();
    expect(within(outline).queryByText('Search Scopus')).not.toBeInTheDocument();
  });

  it('shows goal progress computed by the shared tree logic', () => {
    render(<App />);
    // 3 of 6 leaves are done.
    expect(screen.getByRole('progressbar', { name: 'Thesis progress' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
  });
});
