import { describe, it, expect } from 'vitest';
import { listSubjectPdfs } from '../listSubjectPdfs';
import type { ParsedFile } from '../../../../types/documents';

const row = (over: Partial<ParsedFile>): ParsedFile => ({
  subfolder: '',
  file_name: 'x',
  file_comment: '',
  author: '',
  date: '01.01.2026',
  files: [],
  ...over,
});

describe('listSubjectPdfs', () => {
  it('flattens PDF attachments with the row name and IS document date, skipping the rest', () => {
    const files = [
      row({
        file_name: 'Přednáška 09',
        date: '12. 3. 2026',
        files: [
          { name: 'p', type: 'unknown', link: 'https://is/viewer?dok=1' },
          { name: 'p', type: 'pdf', link: 'https://is/slozka.pl?download=1' },
        ],
      }),
      row({ file_name: 'Slides', files: [{ name: 's', type: 'pptx', link: 'https://is/2.pptx' }] }),
      row({
        file_name: 'Skripta',
        date: '02.02.2026',
        files: [
          { name: 'a', type: '', link: 'https://is/a.PDF' },
          { name: 'b', type: 'pdf', link: 'https://is/b.pdf' },
        ],
      }),
    ];
    expect(listSubjectPdfs(files)).toEqual([
      { link: 'https://is/slozka.pl?download=1', name: 'Přednáška 09', date: '12. 3. 2026' },
      { link: 'https://is/a.PDF', name: 'Skripta (1)', date: '02.02.2026' },
      { link: 'https://is/b.pdf', name: 'Skripta (2)', date: '02.02.2026' },
    ]);
  });

  it('is empty for no files', () => {
    expect(listSubjectPdfs(null)).toEqual([]);
    expect(listSubjectPdfs([])).toEqual([]);
  });
});
