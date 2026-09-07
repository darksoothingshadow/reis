import { useTranslation } from '@/hooks/useTranslation';
import { ErasmusReportCard } from './ErasmusReportCard';
import type { ErasmusReport } from '@/types/erasmus';
import type { ErasmusConfig } from '@/types/erasmus';
import type { UserParams } from '@/utils/userParams';
import { GraduationCap, X, Filter, ChevronDown, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { AdaptiveDrawer } from '@/components/ui/AdaptiveDrawer';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';

const FACULTY_ABBREV_TO_NAME: Record<string, string> = {
  PEF: 'Provozně ekonomická fakulta',
  AF: 'Agronomická fakulta',
  LDF: 'Lesnická a dřevařská fakulta',
  FRRMS: 'Fakulta regionálního rozvoje a mezinárodních studií',
  ZF: 'Zahradnická fakulta',
};

interface ErasmusDrawerProps {
  isOpen: boolean;
  countryName: string;
  filteredReports: ErasmusReport[];
  displayedReports: ErasmusReport[];
  schools: string[];
  schoolFilter: string | null;
  setSchoolFilter: (v: string | null) => void;
  facultyFilter: boolean;
  setFacultyFilter: (v: boolean) => void;
  userParams: UserParams | null;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
  loading: boolean;
  config: ErasmusConfig | null;
  onClose: () => void;
}

export function ErasmusDrawer({
  isOpen,
  countryName,
  filteredReports,
  displayedReports,
  schools,
  schoolFilter,
  setSchoolFilter,
  facultyFilter,
  setFacultyFilter,
  userParams,
  showAll,
  setShowAll,
  loading,
  config,
  onClose,
}: ErasmusDrawerProps) {
  const { t } = useTranslation();

  return (
    <AdaptiveDrawer open={isOpen} onClose={onClose} title={countryName}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-base-300">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base">{countryName}</h3>
          <p className="text-xs text-base-content/70">
            {filteredReports.length} {t('erasmus.reports')}
            {schoolFilter && ` · ${schoolFilter}`}
          </p>
          {config && userParams?.facultyLabel && config.faculties[userParams.facultyLabel] && (
            <p className="text-[11px] text-base-content/70 flex items-center gap-2 mt-1 px-0.5">
              <span className="shrink-0">{t('erasmus.coordinator')}:</span>
              <span className="font-medium text-base-content/80 truncate">
                {config.faculties[userParams.facultyLabel].coordinator}
              </span>
              <button
                onClick={() => {
                  const email = config.faculties[userParams.facultyLabel!].email;
                  navigator.clipboard
                    .writeText(email)
                    .then(() => {
                      toast.success(t('common.copiedToClipboard'));
                    })
                    .catch(() => {
                      const input = document.createElement('input');
                      input.value = email;
                      document.body.appendChild(input);
                      input.select();
                      document.execCommand('copy');
                      document.body.removeChild(input);
                      toast.success(t('common.copiedToClipboard'));
                    });
                }}
                className="btn btn-ghost btn-xs w-6 h-6 p-0 min-h-0 text-[var(--tone-primary)] hover:bg-primary/10 transition-colors shrink-0"
                title={config.faculties[userParams.facultyLabel].email}
              >
                <Mail size={12} />
              </button>
            </p>
          )}
        </div>
        <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle">
          <X size={16} />
        </button>
      </div>

      {/* Filters */}
      {!loading && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            {schools.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="btn btn-sm btn-ghost border border-base-300 flex-1 justify-between font-normal px-3 pl-8 relative min-w-0">
                    <Filter
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/70 z-10"
                    />
                    <span className="truncate mr-1">{schoolFilter ?? t('erasmus.allSchools')}</span>
                    <ChevronDown size={14} className="opacity-50 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[calc(600px-2rem)] max-w-[calc(100vw-2rem)] max-h-60 overflow-y-auto overflow-x-hidden p-1 shadow-2xl rounded-xl">
                  <DropdownMenuRadioGroup
                    value={schoolFilter || 'all'}
                    onValueChange={(val) => {
                      setSchoolFilter(val === 'all' ? null : val);
                      setShowAll(false);
                    }}
                  >
                    <DropdownMenuRadioItem value="all" className="rounded-lg py-1.5">
                      <span className="text-sm font-medium">{t('erasmus.allSchools')}</span>
                    </DropdownMenuRadioItem>
                    {schools.map((school) => (
                      <DropdownMenuRadioItem
                        key={school}
                        value={school}
                        className="rounded-lg py-1.5"
                      >
                        <span className="text-sm font-medium truncate w-full">{school}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {userParams?.facultyLabel && FACULTY_ABBREV_TO_NAME[userParams.facultyLabel] && (
              <button
                onClick={() => {
                  setFacultyFilter(!facultyFilter);
                  setShowAll(false);
                }}
                className={`btn btn-sm w-32 gap-1.5 shrink-0 border ${facultyFilter ? 'btn-primary border-primary' : 'btn-ghost border-base-300'}`}
              >
                <GraduationCap size={14} />
                {userParams.facultyLabel}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="loading loading-spinner loading-md" />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-base-content/70 text-sm">
            {t('erasmus.noData')}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              {displayedReports.map((report: ErasmusReport) => (
                <ErasmusReportCard key={report.reportId} report={report} />
              ))}
            </div>

            {!showAll && filteredReports.length > 10 && (
              <button
                onClick={() => setShowAll(true)}
                className="btn btn-ghost btn-sm text-[var(--tone-primary)]"
              >
                {t('erasmus.showMore')} ({filteredReports.length - 10})
              </button>
            )}
          </div>
        )}
      </div>
    </AdaptiveDrawer>
  );
}
