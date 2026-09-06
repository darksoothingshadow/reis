import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { ExternalLink, Info, Plus } from 'lucide-react';
import { useErasmus } from '@/hooks/data/useErasmus';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/store/useAppStore';
import { useStudyPlan } from '@/hooks/useStudyPlan';
import { ERASMUS_COUNTRIES } from '@/constants/erasmusCountries';
import { EuropeMap } from './EuropeMap';
import { ErasmusDrawer } from './ErasmusDrawer';
import { StudentInfoSection } from './StudentInfoSection';
import { LATableA } from './LATableA';
import { ErasmusExportButton } from './ErasmusExportButton';
import { getUserParams, type UserParams } from '@/utils/userParams';
import { fetchKontrolaData } from '@/api/kontrola';
import type { StudyPlan } from '@/types/studyPlan';

const FACULTY_ABBREV_TO_NAME: Record<string, string> = {
  PEF: 'Provozně ekonomická fakulta',
  AF: 'Agronomická fakulta',
  LDF: 'Lesnická a dřevařská fakulta',
  FRRMS: 'Fakulta regionálního rozvoje a mezinárodních studií',
  ZF: 'Zahradnická fakulta',
  ICV: 'Institut celoživotního vzdělávání',
};

interface ErasmusPanelProps {
  onOpenSubject: (courseCode: string, courseName?: string, courseId?: string) => void;
  onSearchSubject: (name: string) => void;
  /**
   * Hides the Learning Agreement tab, leaving only Explore. Off on mobile: the
   * LA is a wide two-table editing surface that does not belong on a phone.
   * Defaults to shown so the desktop sidebar is untouched.
   */
  showLearningAgreement?: boolean;
}

export function ErasmusPanel({
  onOpenSubject,
  onSearchSubject,
  showLearningAgreement = true,
}: ErasmusPanelProps) {
  const { t, language } = useTranslation();
  const lang = language === 'en' ? 'en' : 'cs';
  const { reports, countryFile, setCountry, loading, config } = useErasmus();
  const plan = useStudyPlan();
  const tableBCourses = useAppStore((s) => s.erasmusTableBCourses);
  const tableAOptions = useAppStore((s) => s.erasmusTableAOptions);
  const addOption = useAppStore((s) => s.addErasmusTableAOption);
  const activeTab = useAppStore((s) => s.erasmusActiveTab);
  const setActiveTab = useAppStore((s) => s.setErasmusActiveTab);
  const loadState = useAppStore((s) => s.loadErasmusState);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [schoolFilter, setSchoolFilter] = useState<string | null>(null);
  const [facultyFilter, setFacultyFilter] = useState(false);
  const [userParams, setUserParams] = useState<UserParams | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Track if we are "Peeking" (temp viewing) vs "Planning" (committing)
  const previousCountryRef = useRef<string | null>(null);
  const isPeekingRef = useRef(false);

  const [dob, setDob] = useState('');

  useEffect(() => {
    // getUserParams is unconditional: the Explore tab's faculty filter reads
    // userParams.facultyLabel, and Explore is the one tab the phone shows.
    getUserParams().then(setUserParams);
    // The date of birth is not. It renders in exactly one place —
    // StudentInfoSection, inside the Learning Agreement tab — so with the LA
    // hidden this was pulling a student's birth date that nothing could
    // display. Fetch no personal data a surface cannot render.
    if (!showLearningAgreement) return;
    fetchKontrolaData().then((data) => {
      if (!data) return;
      const [year, month, day] = data.datumNarozeni.split('-');
      const formatted = `${day}.${month}.${year}`;
      setDob(formatted);
    });
  }, [showLearningAgreement]);

  const currentCountry = useMemo(
    () => ERASMUS_COUNTRIES.find((c) => c.file === countryFile),
    [countryFile]
  );
  const countryName = currentCountry ? currentCountry[lang] : '';
  const currentCountryId = currentCountry?.id ?? '';

  const schools = useMemo(
    () => Array.from(new Set(reports.map((r) => r.host.name))).sort(),
    [reports]
  );

  const filteredReports = useMemo(() => {
    let base = reports.filter((r) => r.stay.durationMonths > 2);
    if (schoolFilter) base = base.filter((r) => r.host.name === schoolFilter);
    const fullFaculty =
      facultyFilter && userParams?.facultyLabel
        ? FACULTY_ABBREV_TO_NAME[userParams.facultyLabel]
        : null;
    if (fullFaculty) base = base.filter((r) => r.student.faculty === fullFaculty);
    return base;
  }, [reports, schoolFilter, facultyFilter, userParams]);

  const displayedReports = useMemo(() => {
    return showAll ? filteredReports : filteredReports.slice(0, 10);
  }, [filteredReports, showAll]);

  const handleViewReports = useCallback(
    (file: string, schoolName: string | null, isPermanent: boolean = false) => {
      // If permanent, we update the store and ensure we don't restore later.
      // If temporary (peek), we save the previous state to restore on close.
      if (isPermanent) {
        setCountry(file);
        isPeekingRef.current = false;
        previousCountryRef.current = null;
      } else if (file !== countryFile) {
        previousCountryRef.current = countryFile || null;
        isPeekingRef.current = true;
        setCountry(file);
      }
      setSchoolFilter(schoolName);
      setDrawerOpen(true);
    },
    [setCountry, countryFile]
  );

  const handleTabChange = (tab: 'plan' | 'explore') => {
    setActiveTab(tab);
    if (tab === 'plan') {
      // Close drawer and restore original country if we were just peeking
      setDrawerOpen(false);
      if (isPeekingRef.current) {
        setCountry(previousCountryRef.current || '');
        isPeekingRef.current = false;
        previousCountryRef.current = null;
      }
    }
  };

  const handleClose = useCallback(() => {
    setDrawerOpen(false);
    // If we were peeking, restore the original selection
    if (isPeekingRef.current) {
      setCountry(previousCountryRef.current || '');
      isPeekingRef.current = false;
      previousCountryRef.current = null;
    }
  }, [setCountry]);

  const hasAnyCoursesSelected = Object.values(tableBCourses).some((arr) => arr.length > 0);

  // The store's activeTab persists, so a student who last used 'plan' on desktop
  // would otherwise land on a tab this render has no button for — and no way
  // back. Resolving it here rather than writing to the store keeps the desktop
  // preference intact.
  const tabs = showLearningAgreement ? (['plan', 'explore'] as const) : (['explore'] as const);
  const currentTab = showLearningAgreement ? activeTab : 'explore';

  return (
    <div className="h-full flex flex-col">
      {/* One tab is not a tab bar. */}
      <div
        className={`flex items-center gap-1 px-4 pt-3 pb-1 border-b border-base-300 ${
          tabs.length > 1 ? '' : 'hidden'
        }`}
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-3 py-1.5 rounded-t-lg text-xs font-bold transition-all border-b-2 ${
              currentTab === tab
                ? 'border-primary text-[var(--tone-primary)] bg-primary/12'
                : 'border-transparent text-base-content/70 hover:text-base-content'
            }`}
          >
            {tab === 'plan' ? t('erasmus.tabPlan') : t('erasmus.tabExplore')}
          </button>
        ))}
      </div>

      {currentTab === 'plan' && (
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-5">
          <StudentInfoSection userParams={userParams} dob={dob} />

          <LATableA
            plan={plan ?? ({ blocks: [] } as unknown as StudyPlan)}
            onOpenSubject={onOpenSubject}
            onSearchSubject={onSearchSubject}
            onViewReports={handleViewReports}
          />

          <div className="flex w-full items-center justify-between mt-2 pt-4 pb-4 border-t border-base-200">
            <div className="flex items-center gap-3">
              {tableAOptions.length < 4 && (
                <button
                  onClick={addOption}
                  className="btn btn-ghost btn-sm rounded-full px-4 h-8 text-base-content/70 hover:text-base-content/70 border border-base-300 hover:border-base-content/20 font-normal"
                >
                  <Plus size={14} className="opacity-70" />
                  <span className="font-bold text-xs">
                    {t('erasmus.addOption', { n: (tableAOptions.length + 1).toString() })}
                  </span>
                </button>
              )}
              {hasAnyCoursesSelected && (
                <a
                  href={t('erasmus.erasmusCoordinators')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm gap-1.5 text-xs text-base-content/60 hover:text-base-content/80 font-normal px-2"
                >
                  {t('erasmus.contactCoordinator')}
                  <ExternalLink size={12} className="opacity-70" />
                </a>
              )}
            </div>

            <ErasmusExportButton className="btn-primary" />
          </div>
        </div>
      )}

      {currentTab === 'explore' && (
        <div className="flex-1 min-h-0 px-4 pb-4 pt-2 flex flex-col gap-2">
          <div className="flex items-start gap-2 px-1 py-1.5 text-[10px] text-base-content/70 leading-relaxed">
            <Info size={12} className="shrink-0 mt-0.5 text-info" />
            <span>{t('erasmus.exploreDisclaimer')}</span>
          </div>
          <div className="bg-base-200 rounded-xl p-2 border border-base-300 flex-1 min-h-0">
            <EuropeMap
              selectedCountryId={drawerOpen ? currentCountryId : ''}
              onSelectCountry={(id) => {
                const c = ERASMUS_COUNTRIES.find((e) => e.id === id);
                if (c) handleViewReports(c.file, null);
              }}
              lang={lang}
            />
          </div>
        </div>
      )}

      {/* Always mounted so AdaptiveDrawer (vaul on phone) can observe
          open: true→false and play its exit animation. */}
      <ErasmusDrawer
        isOpen={drawerOpen}
        filteredReports={filteredReports}
        displayedReports={displayedReports}
        countryName={countryName}
        schools={schools}
        schoolFilter={schoolFilter}
        setSchoolFilter={setSchoolFilter}
        facultyFilter={facultyFilter}
        setFacultyFilter={setFacultyFilter}
        userParams={userParams}
        showAll={showAll}
        setShowAll={setShowAll}
        loading={loading}
        config={config}
        onClose={handleClose}
      />
    </div>
  );
}
