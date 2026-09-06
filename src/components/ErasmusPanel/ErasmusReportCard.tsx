import { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { ErasmusReport } from '@/types/erasmus';

const FACULTY_NAME_TO_ABBREV: Record<string, string> = {
  'Provozně ekonomická fakulta': 'PEF',
  'Agronomická fakulta': 'AF',
  'Lesnická a dřevařská fakulta': 'LDF',
  'Fakulta regionálního rozvoje a mezinárodních studií': 'FRRMS',
  'Zahradnická fakulta': 'ZF',
};

interface Props {
  report: ErasmusReport;
}

export function ErasmusReportCard({ report }: Props) {
  const { t, language: lang } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-base-300 rounded-lg overflow-hidden">
      <button
        className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-base-200 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{report.student.name}</span>
            <span className="badge badge-sm bg-base-200 text-base-content/60">
              {report.host.name.replace('University of ', '')}
            </span>
          </div>
          <div className="text-xs text-base-content/70 mt-0.5">
            {FACULTY_NAME_TO_ABBREV[report.student.faculty] ?? report.student.faculty} ·{' '}
            {report.stay.from} – {report.stay.to} ({report.stay.durationMonths}
            {t('erasmus.months')})
          </div>
        </div>
        <div className="flex items-center shrink-0">
          <ChevronDown
            className={`w-4 h-4 text-base-content/70 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-base-300 text-sm space-y-3">
          {/* Finance */}
          <div className="pt-2">
            <h4 className="font-semibold text-xs text-base-content/70 mb-1">
              {t('erasmus.finance')}
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {report.finance.totalCostCZK && (
                <div>
                  {t('erasmus.totalCost')}:{' '}
                  <strong>
                    {report.finance.totalCostCZK} {t('common.czk')}
                  </strong>
                </div>
              )}
              {report.finance.grantCoveragePercent && (
                <div>
                  {t('erasmus.grantCoverage')}:{' '}
                  <strong>{report.finance.grantCoveragePercent}%</strong>
                </div>
              )}
            </div>
          </div>

          {/* Review */}
          {report.overall.review && (
            <div>
              <h4 className="font-semibold text-xs text-base-content/70 mb-1">
                {t('erasmus.review')}
              </h4>
              <p className="text-xs text-base-content/70 leading-relaxed">
                {report.overall.review}
              </p>
            </div>
          )}

          {/* Tips */}
          {(report.tips.problemsDuring || report.tips.positivesDuring) && (
            <div>
              <h4 className="font-semibold text-xs text-base-content/70 mb-1">
                {t('erasmus.tips')}
              </h4>
              {report.tips.problemsDuring && (
                <p className="text-xs text-base-content/70">
                  <span className="text-error/70">{t('erasmus.problems')}:</span>{' '}
                  {report.tips.problemsDuring}
                </p>
              )}
              {report.tips.positivesDuring && (
                <p className="text-xs text-base-content/70 mt-1">
                  <span className="text-success/70">{t('erasmus.positives')}:</span>{' '}
                  {report.tips.positivesDuring}
                </p>
              )}
            </div>
          )}

          {/* Accommodation details */}
          {report.accommodation.foodNotes && (
            <div>
              <h4 className="font-semibold text-xs text-base-content/70 mb-1">
                {t('erasmus.food')}
              </h4>
              <p className="text-xs text-base-content/70">{report.accommodation.foodNotes}</p>
            </div>
          )}

          {/* External link */}
          <a
            href={`https://is.mendelu.cz/auth/int/zavzpr.pl?akce=1;zobrazit=${report.reportId};lang=${lang === 'en' ? 'en' : 'cz'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--tone-primary)] hover:text-primary-focus transition-colors"
          >
            {t('erasmus.openInIS')}
            <ExternalLink size={14} />
          </a>
        </div>
      )}
    </div>
  );
}
