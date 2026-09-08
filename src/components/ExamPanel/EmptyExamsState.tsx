import { Coffee } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export function EmptyExamsState() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4 animate-in fade-in duration-300">
      <div className="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center mb-4">
        <Coffee className="w-8 h-8 text-base-content/70" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-base-content/80 mb-2">{t('exams.emptyTitle')}</h3>
      <p className="text-sm text-base-content/70 max-w-sm">{t('exams.emptySubtitle')}</p>
    </div>
  );
}
