/**
 * One attachment row inside the file drawer.
 *
 * Split out of FileList so that file stays within the 200-line convention;
 * FileList owns the grouping and this owns a single row's rendering.
 */

import { Download, PanelRightOpen, StickyNote } from 'lucide-react';
import type { FileAttachment } from '../../types/documents';
import { useTranslation } from '../../hooks/useTranslation';
import { DocumentNoteEditor } from './DocumentNoteEditor';
import { NOTES_ENABLED } from '../../config/featureFlags';
import { FileTypeBadge } from './fileRowBits';
import { isPdfFile, opensInReader } from './utils/isPdfFile';
import type { PdfRowMeta } from './types';

export interface FileListItemProps {
  subFile: FileAttachment;
  /** Already carries the "(n)" suffix when a row holds several attachments. */
  displayName: string;
  date: string;
  comment?: string;
  isNew: boolean;
  isSelected: boolean;
  selectable: boolean;
  hasNote: boolean;
  isExpanded: boolean;
  courseCode: string;
  fileRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  ignoreClickRef: React.MutableRefObject<boolean>;
  onToggleSelect: (id: string, e: React.SyntheticEvent) => void;
  onOpenFile: (link: string) => void;
  onViewPdf?: (link: string, meta: PdfRowMeta) => void;
  onDownloadSingle?: (link: string) => void;
  onToggleNote: () => void;
  onCloseNote: () => void;
}

export function FileListItem({
  subFile,
  displayName,
  date,
  comment,
  isNew,
  isSelected,
  selectable,
  hasNote,
  isExpanded,
  courseCode,
  fileRefs,
  ignoreClickRef,
  onToggleSelect,
  onOpenFile,
  onViewPdf,
  onDownloadSingle,
  onToggleNote,
  onCloseNote,
}: FileListItemProps) {
  const { t } = useTranslation();

  // Click and Enter/Space must do the same thing, so the decision lives once.
  const activate = (e: React.SyntheticEvent & { ctrlKey?: boolean; metaKey?: boolean }) => {
    if (ignoreClickRef.current) return;
    if (e.ctrlKey || e.metaKey) {
      onToggleSelect(subFile.link, e);
    } else if (onViewPdf && opensInReader(subFile)) {
      onViewPdf(subFile.link, { name: displayName, date });
    } else {
      onOpenFile(subFile.link);
    }
  };

  return (
    <div className="space-y-1">
      <div
        ref={(el) => {
          if (el) {
            fileRefs.current.set(subFile.link, el);
          } else {
            fileRefs.current.delete(subFile.link);
          }
        }}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activate(e);
          }
        }}
        onClick={activate}
        className={`
          flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer group hover:shadow-sm
          focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none
          ${
            isSelected
              ? 'bg-primary/10 border-primary/20 shadow-sm'
              : 'bg-base-100 border-transparent hover:bg-base-200/50 hover:border-base-300'
          }
        `}
      >
        {selectable && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onToggleSelect(subFile.link, e)}
            onClick={(e) => e.stopPropagation()}
            className="checkbox checkbox-xs checkbox-primary interactive shrink-0"
          />
        )}

        <div className="flex-1 min-w-0">
          <div
            className={`font-medium truncate flex items-center gap-2 ${isSelected ? 'text-primary' : 'text-base-content'}`}
          >
            <span className="truncate">{displayName}</span>
            {isNew && (
              <span className="badge badge-primary badge-xs font-bold shrink-0">
                {t('course.freshness.newBadge')}
              </span>
            )}
          </div>
          <div className="text-xs text-base-content/50 truncate flex items-center gap-2">
            {date && <span className="shrink-0">{date}</span>}
            {comment && <span className="truncate">{comment}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {NOTES_ENABLED && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleNote();
              }}
              className={`btn btn-ghost btn-xs btn-square ${hasNote || isExpanded ? 'text-primary hover:text-primary' : 'text-base-content/40 hover:text-base-content/70'}`}
              title={hasNote ? t('course.documentNote.edit') : t('course.documentNote.add')}
            >
              <StickyNote size={14} className={hasNote ? 'fill-primary/15' : ''} />
            </button>
          )}
          {onDownloadSingle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownloadSingle(subFile.link);
              }}
              className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content/70"
              title={t('course.footer.download') || 'Download'}
            >
              <Download size={14} />
            </button>
          )}
          {isPdfFile(subFile) && onViewPdf && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewPdf(subFile.link, { name: displayName, date });
              }}
              className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-primary"
              title={t('course.footer.openInSidebar') || 'Open in Sidebar'}
            >
              <PanelRightOpen size={14} />
            </button>
          )}
          <FileTypeBadge type={subFile.type} />
        </div>
      </div>

      {NOTES_ENABLED && isExpanded && (
        <div
          className="px-2 pb-2"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <DocumentNoteEditor
            courseCode={courseCode}
            fileLink={subFile.link}
            fileName={displayName}
            onClose={onCloseNote}
          />
        </div>
      )}
    </div>
  );
}
