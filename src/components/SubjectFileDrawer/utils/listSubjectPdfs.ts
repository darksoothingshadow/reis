import type { ParsedFile } from '../../../types/documents';
import { collapseAttachments } from '../../../api/documents/collapseAttachments';
import { isPdfFile } from './isPdfFile';

/** One PDF the iPad reader's sidebar can switch to. */
export interface SubjectPdf {
  link: string;
  name: string;
  date: string;
}

/**
 * The subject's PDFs in the order and with the names the file list shows them,
 * so the reader's sidebar and the drawer never disagree about what a file is
 * called. Same collapse (viewer+download pair → one) and the same "(n)" suffix
 * rule as FileList; non-PDF attachments are skipped.
 */
export function listSubjectPdfs(files: ParsedFile[] | null | undefined): SubjectPdf[] {
  if (!files) return [];
  const out: SubjectPdf[] = [];
  for (const file of files) {
    const attachments = collapseAttachments(file.files);
    attachments.forEach((attachment, j) => {
      if (!isPdfFile(attachment)) return;
      out.push({
        link: attachment.link,
        name: attachments.length > 1 ? `${file.file_name} (${j + 1})` : file.file_name,
        date: file.date,
      });
    });
  }
  return out;
}
