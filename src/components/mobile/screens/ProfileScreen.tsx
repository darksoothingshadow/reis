import { useState } from 'react';
import { Wifi, FileText, BedDouble, MessageSquarePlus, LogOut, User } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useSpolkySettings } from '../../../hooks/useSpolkySettings';
import { useStudyPlan } from '../../../hooks/useStudyPlan';
import { useTranslation } from '../../../hooks/useTranslation';
import { SpolkySection } from '../../Sidebar/Profile/SpolkySection';
import { HiddenItemsSection } from '../../Sidebar/Profile/HiddenItemsSection';
import { FeedbackModal } from '../../Feedback/FeedbackModal';
import { SignOutConfirm } from '../sheets/SignOutConfirm';
import { PersonPhoto } from '../../ui/PersonPhoto';
import { AboutSection } from './profile/AboutSection';
import { NavRow } from '../primitives/NavRow';
import { MapAppRow } from './profile/MapAppRow';
import { AppearanceRows } from './profile/AppearanceRows';
import { ScreenHeader } from './calendar/ScreenHeader';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * The profile TAB: theme, language, eduroam setup,
 * hidden items, society map filters, feedback and logout. Reuses desktop's
 * `SpolkySection` / `HiddenItemsSection` / `FeedbackModal` wholesale rather
 * than rebuilding them — only the row layout around them is phone-specific.
 *
 * `HiddenItemsSection` is the same component the desktop sidebar profile
 * uses, so an event `EventDetailSheet` hides shows up here already —
 * restoring it calls the same `unhideEvent` action that removes it from the
 * store's `hiddenItems`.
 */
export function ProfileScreen() {
  const { t } = useTranslation();
  const fullName = useAppStore((s) => s.fullName);
  const { isSubscribed, toggleAssociation } = useSpolkySettings();
  const pushSheet = useAppStore((s) => s.pushSheet);
  const setMobileTab = useAppStore((s) => s.setMobileTab);
  const plan = useStudyPlan();
  const [spolkyOpen, setSpolkyOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const studentId = useAppStore((s) => s.studentId);

  const name = fullName ?? '';

  return (
    <div data-testid="profile-screen" className="flex flex-1 flex-col overflow-hidden">
      {/* No eyebrow: the header's title block shares its row with the three
          action buttons, so at 320px it has ~152px — a programme name needs
          206px and was truncated there. The identity gets its own full-width
          block below instead, which is where it lived as a sheet. */}
      <ScreenHeader title={t('sidebar.profile')} />
      <div className="flex-shrink-0">
        <div className="flex items-center gap-3 px-4 pb-3 pt-1">
          {/* The student's own face, the one photo the app never showed: this
              sheet rendered initials, and a generic glyph whenever `fullName`
              had not resolved. `studentId` is IS's "Identifikační číslo
              uživatele", the same id space `foto.pl` takes for everyone else,
              so the existing authenticated fetch covers this with no new
              endpoint. Initials stay as the fallback while it loads or when
              there is no picture. */}
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-base-200 font-display text-base font-bold text-primary">
            <PersonPhoto
              personId={studentId}
              alt={name}
              className="h-full w-full object-cover"
              fallback={name ? initials(name) : <User size={18} />}
            />
          </div>
          {/* No close button: this is a tab, not a sheet — the nav is how you
              leave.

              The name WRAPS rather than truncating. At 320px "Marie Anna
              Nováková-Svobodová" needs 287px in a 232px slot, and losing
              "-Svobodová" is worse than a second line — it is the half that
              tells two siblings apart. The programme under it still truncates:
              it is context, and it has the full row to do it in now. */}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-display text-lg font-bold leading-tight tracking-tight">
              {name}
            </span>
            {plan?.title && (
              <span className="truncate text-sm text-base-content/60">{plan.title}</span>
            )}
          </div>
        </div>
      </div>

      {/* pb-[84px], not pb-24. The floating BottomNav needs 76px of clearance —
          measured, `innerHeight - nav.top` at 375×780 — and 96 reserved 20px of
          nothing at the bottom of a screen that must not scroll. 8px of margin
          over the measurement, so a taller nav does not silently tuck under. */}
      <div className="flex-1 overflow-y-auto pb-[84px]">
        <div className="px-4 pb-0.5 pt-2 text-xs font-bold uppercase tracking-wider text-base-content/60">
          {t('mobile.profile.appearance')}
        </div>
        <AppearanceRows />

        <div className="px-4 pb-0.5 pt-2 text-xs font-bold uppercase tracking-wider text-base-content/60">
          {t('mobile.profile.settings')}
        </div>
        {/* eduroam lives here rather than on the Student hub: it is a one-time
            device setup, which is what a settings screen is for, and it was
            competing for attention with everyday shortcuts. One tap, same
            sheet — SheetHost stacks it above this one. */}
        <NavRow
          icon={Wifi}
          label={t('mobile.student.eduroam')}
          sublabel={t('mobile.student.eduroamSub')}
          onClick={() => pushSheet({ kind: 'eduroam' })}
        />
        {/* Dokumenty was the last card on the Student hub. The hub's IS page
            directory is gone from the phone tree (every link opened the system
            browser, which has no IS session), so the card follows eduroam here
            rather than keeping a whole segment alive for one button. */}
        <NavRow
          icon={FileText}
          label={t('mobile.student.documents')}
          sublabel={t('mobile.student.documentsSub')}
          onClick={() => pushSheet({ kind: 'docs' })}
        />
        {/* Housing: rooms from students for students. A settings-list row, not a
            tab — it matters for two months a year. */}
        <NavRow
          icon={BedDouble}
          label={t('mobile.profile.housing')}
          sublabel={t('mobile.profile.housingSub')}
          onClick={() => pushSheet({ kind: 'housing' })}
        />

        <MapAppRow />

        <HiddenItemsSection />

        <div className="px-4 pb-0.5 pt-2 text-xs font-bold uppercase tracking-wider text-base-content/60">
          {t('mobile.profile.societies')}
        </div>
        <div className="px-3">
          <SpolkySection
            expandFully
            expanded={spolkyOpen}
            onToggle={() => setSpolkyOpen((v) => !v)}
            isSub={isSubscribed}
            onToggleAssoc={toggleAssociation}
            onNavigate={() => setMobileTab('map')}
          />
        </div>

        <div className="mx-4 my-2 h-px bg-base-content/10" />

        <NavRow
          icon={MessageSquarePlus}
          label={t('settings.reportBug')}
          onClick={() => setFeedbackOpen(true)}
        />

        <button
          type="button"
          onClick={() => setSignOutOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-3 text-error"
        >
          <LogOut size={17} className="flex-shrink-0" />
          <span className="flex-1 text-left text-md font-medium">{t('settings.logout')}</span>
        </button>

        {/* Open, not behind a row: a credit that has to be opened is a credit
            nobody reads, and a student writing a bug report should find the
            version without hunting for it. */}
        <AboutSection />
      </div>

      <SignOutConfirm open={signOutOpen} onCancel={() => setSignOutOpen(false)} />
      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
