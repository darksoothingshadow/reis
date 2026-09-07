/** IS does not always report a type, so the extension is the fallback signal. */
export function isPdfFile(subFile: { link: string; type: string }): boolean {
  return subFile.type === 'pdf' || subFile.link.toLowerCase().endsWith('.pdf');
}

/**
 * Whether a row should open in the reader rather than download.
 *
 * IS reports the type from the row's mime icon and leaves plenty of documents
 * as 'unknown' — its download links carry no extension either, so a real PDF
 * can look like nothing at all. Reading is what a student wants from a document
 * they tapped, so an untyped row is given the reader as well; the fetch checks
 * the bytes (useFileActions.fetchPdfBlob) and anything that is not a PDF falls
 * back to the download it would have got.
 */
export function opensInReader(subFile: { link: string; type: string }): boolean {
  return isPdfFile(subFile) || subFile.type === 'unknown' || subFile.type === '';
}
