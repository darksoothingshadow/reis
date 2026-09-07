import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const openRecentPdf = vi.fn(async () => undefined);
vi.mock('../../../../../hooks/ui/useRecentPdfOpen', () => ({
  useRecentPdfOpen: () => ({ openRecentPdf, isOpening: false }),
}));

import { RecentFilesStrip } from '../RecentFilesStrip';
import { useAppStore } from '../../../../../store/useAppStore';
import type { RecentPdf } from '../../../../../utils/mobile/recentPdfs';

const row = (key: string, name: string, courseCode = 'EBC-AP'): RecentPdf => ({
  key,
  courseCode,
  link: `https://is/${key}`,
  name,
  date: '12. 3. 2026',
  lastOpenedAt: 1,
});

describe('RecentFilesStrip', () => {
  const dismissRecentPdf = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      language: 'cz',
      subjects: null,
      dismissRecentPdf,
      recentPdfs: [row('a', 'Přednáška 09'), row('b', 'Skripta')],
    } as never);
  });

  it('renders nothing when the selected day is not today', () => {
    render(<RecentFilesStrip visible={false} />);
    expect(screen.queryByTestId('recent-files')).toBeNull();
  });

  it('renders nothing when there is nothing recent', () => {
    useAppStore.setState({ recentPdfs: [] } as never);
    render(<RecentFilesStrip visible />);
    expect(screen.queryByTestId('recent-files')).toBeNull();
  });

  it('lists the files under the heading, subject code as the second line', () => {
    render(<RecentFilesStrip visible />);
    expect(screen.getByText('Naposledy otevřené')).toBeInTheDocument();
    expect(screen.getByText('Přednáška 09')).toBeInTheDocument();
    expect(screen.getAllByText('EBC-AP')).toHaveLength(2);
  });

  it('tapping a row opens it and does not dismiss it', () => {
    render(<RecentFilesStrip visible />);
    fireEvent.click(screen.getByText('Skripta'));
    expect(openRecentPdf).toHaveBeenCalledWith(expect.objectContaining({ key: 'b' }));
    expect(dismissRecentPdf).not.toHaveBeenCalled();
  });

  it('the X dismisses that row and does not open it', () => {
    render(<RecentFilesStrip visible />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Zavřít' })[0]!);
    expect(dismissRecentPdf).toHaveBeenCalledWith('a');
    expect(openRecentPdf).not.toHaveBeenCalled();
  });
});
