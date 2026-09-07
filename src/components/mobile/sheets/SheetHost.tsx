import { useAppStore } from '../../../store/useAppStore';
import { SubjectDrawerSheet } from './SubjectDrawerSheet';
import { EventDetailSheet } from './EventDetailSheet';
import { StudyPlanSheet } from './StudyPlanSheet';
import { NotificationsSheet } from './NotificationsSheet';
import { PersonSheet } from './PersonSheet';
import { PersonPhotoSheet } from './PersonPhotoSheet';
import { EduroamSheet } from './EduroamSheet';
import { DocsSheet } from './DocsSheet';
import { SearchSheet } from './SearchSheet';
import { BulletinSheet } from './BulletinSheet';
import { MenuSheet } from './MenuSheet';
import { VenueSheet } from './VenueSheet';

/**
 * Renders the phone UI's sheet stack, in order, each in its own `Sheet`.
 * Mounted once in `MobileApp`, after `<BottomNav />` — every future sheet
 * kind registers here via the `switch` below rather than mounting itself.
 *
 * Unknown/unimplemented `kind`s render nothing rather than throwing: the
 * `MobileSheet` union still lists `confirm`, which self-mounts inside
 * `ExamsScreen` instead of going through this host.
 */
export function SheetHost() {
  const sheets = useAppStore((s) => s.mobileSheets);
  const popSheet = useAppStore((s) => s.popSheet);

  return (
    <>
      {sheets.map((sheet, index) => {
        switch (sheet.kind) {
          case 'subjectDrawer':
            return <SubjectDrawerSheet key={index} sheet={sheet} onClose={popSheet} />;
          case 'eventDetail':
            return <EventDetailSheet key={index} sheet={sheet} onClose={popSheet} />;
          case 'studyPlan':
            return <StudyPlanSheet key={index} onClose={popSheet} />;
          case 'notifications':
            return <NotificationsSheet key={index} onClose={popSheet} />;
          case 'person':
            return <PersonSheet key={index} sheet={sheet} onClose={popSheet} />;
          case 'personPhoto':
            return <PersonPhotoSheet key={index} sheet={sheet} onClose={popSheet} />;
          case 'eduroam':
            return <EduroamSheet key={index} onClose={popSheet} />;
          case 'docs':
            return <DocsSheet key={index} onClose={popSheet} />;
          case 'bulletin':
            return <BulletinSheet key={index} onClose={popSheet} />;
          case 'venue':
            return <VenueSheet key={index} sheet={sheet} onClose={popSheet} />;
          case 'menu':
            return <MenuSheet key={index} dayIso={sheet.dayIso} onClose={popSheet} />;
          case 'search':
            return <SearchSheet key={index} sheet={sheet} onClose={popSheet} />;
          default:
            return null;
        }
      })}
    </>
  );
}
