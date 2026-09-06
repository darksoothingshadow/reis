import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { HousingBoard } from '../../housing/HousingBoard';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';

export interface HousingSheetProps {
  onClose: () => void;
}

/**
 * Phone host for the housing board (Task 6): rooms from students for
 * students, opened from the profile tab's settings list. `size="full"`,
 * like `SearchSheet` — the board carries a scrolling list of posts plus a
 * floating add button, and `size="content"` (DocsSheet's height, which hugs
 * its own content) would starve both of room.
 *
 * Verifying a poster hands off to the person sheet rather than the desktop's
 * IS page — `HousingBoard`'s `onVerify` is exactly this seam.
 */
export function HousingSheet({ onClose }: HousingSheetProps) {
  const { t } = useTranslation();
  const pushSheet = useAppStore((s) => s.pushSheet);

  return (
    <Sheet size="full" onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col">
        <SheetHeader title={t('housing.title')} subtitle={t('housing.subtitle')} onClose={onClose} />
        <div className="min-h-0 flex-1 overflow-hidden">
          <HousingBoard
            onVerify={(post) =>
              pushSheet({ kind: 'person', personId: post.personId, personName: post.isLogin })
            }
          />
        </div>
      </div>
    </Sheet>
  );
}
