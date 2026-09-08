import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileList } from '../FileList';
import type { FileGroup } from '../types';

vi.mock('../../../hooks/data/useDocumentNoteKeys', () => ({
  useDocumentNoteKeys: () => ({ noteKeys: new Set<string>() }),
}));

const VIEWER =
  'https://is.mendelu.cz/auth/dok_server/dokumenty_cteni.pl?id=1;dok=359057;serializace=x';
const DOWNLOAD = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=359057;id=1';

function groups(files: FileGroup['files']): FileGroup[] {
  return [{ name: 'materials', displayName: 'Materiály', files }];
}

function renderList(over: Partial<Parameters<typeof FileList>[0]> = {}) {
  const props = {
    groups: groups([
      {
        file_name: 'Přednáška 09',
        date: '12. 3. 2026',
        files: [
          { name: 'Přednáška 09', type: 'unknown', link: VIEWER },
          { name: 'Přednáška 09', type: 'pdf', link: DOWNLOAD },
        ],
      },
    ] as unknown as FileGroup['files']),
    selectedIds: [],
    courseCode: 'EBC-MT',
    fileRefs: createRef() as never,
    ignoreClickRef: { current: false },
    onToggleSelect: vi.fn(),
    onOpenFile: vi.fn(),
    ...over,
  };
  // fileRefs is a live Map ref in the real drawer.
  props.fileRefs = { current: new Map() } as never;
  return { props, ...render(<FileList {...(props as Parameters<typeof FileList>[0])} />) };
}

describe('FileList', () => {
  it('renders one row per document, not one per IS link', () => {
    renderList();
    expect(screen.getAllByText('Přednáška 09')).toHaveLength(1);
    // The "(1)" / "(2)" suffixes are what the duplicate rows used to look like.
    expect(screen.queryByText('Přednáška 09 (1)')).toBeNull();
  });

  it('opens the DIRECT DOWNLOAD link, never the old-IS viewer page', async () => {
    const onOpenFile = vi.fn();
    renderList({ onOpenFile });
    await userEvent.click(screen.getByText('Přednáška 09'));
    expect(onOpenFile).toHaveBeenCalledWith(DOWNLOAD);
  });

  it('hands the row name and IS document date along with a PDF link — the iPad reader caches by date', async () => {
    const onViewPdf = vi.fn();
    renderList({ onViewPdf });
    await userEvent.click(screen.getByText('Přednáška 09'));
    expect(onViewPdf).toHaveBeenCalledWith(DOWNLOAD, { name: 'Přednáška 09', date: '12. 3. 2026' });
  });

  it('opens a row IS gave no type in the reader too — IS labels plenty of PDFs "unknown"', async () => {
    const onViewPdf = vi.fn();
    const onOpenFile = vi.fn();
    renderList({
      onViewPdf,
      onOpenFile,
      groups: groups([
        {
          file_name: 'Skripta',
          date: '01. 2. 2026',
          files: [{ name: 'Skripta', type: 'unknown', link: DOWNLOAD }],
        },
      ] as unknown as FileGroup['files']),
    });

    await userEvent.click(screen.getByText('Skripta'));

    expect(onViewPdf).toHaveBeenCalledWith(DOWNLOAD, { name: 'Skripta', date: '01. 2. 2026' });
    expect(onOpenFile).not.toHaveBeenCalled();
  });

  it('still downloads a row IS says is not a PDF', async () => {
    const onViewPdf = vi.fn();
    const onOpenFile = vi.fn();
    renderList({
      onViewPdf,
      onOpenFile,
      groups: groups([
        {
          file_name: 'Tabulka',
          date: '01. 2. 2026',
          files: [{ name: 'Tabulka', type: 'xlsx', link: DOWNLOAD }],
        },
      ] as unknown as FileGroup['files']),
    });

    await userEvent.click(screen.getByText('Tabulka'));

    expect(onOpenFile).toHaveBeenCalledWith(DOWNLOAD);
    expect(onViewPdf).not.toHaveBeenCalled();
  });

  it('shows the empty state when there is nothing to list', () => {
    renderList({ groups: [] });
    expect(screen.queryByText('Přednáška 09')).toBeNull();
  });

  it('hides the selection checkbox when the host turns selection off', () => {
    const { container } = renderList({ selectable: false });
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });

  it('shows it when selection is on — the desktop bulk-download path', () => {
    const { container } = renderList({ selectable: true });
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
  });
});
