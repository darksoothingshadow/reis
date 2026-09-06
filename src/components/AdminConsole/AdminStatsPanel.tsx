import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { StatsBars } from './StatsBars';

export function AdminStatsPanel() {
  const { t } = useTranslation();
  const stats = useAppStore((s) => s.adminStats);
  const loading = useAppStore((s) => s.adminStatsLoading);
  const reload = useAppStore((s) => s.loadAdminStats);
  const under5 = t('admin.stats.under5');
  const label = (k: string) => (k === 'unknown' ? t('admin.stats.unknown') : k);

  if (!stats && !loading) return <div className="alert alert-warning m-2 text-sm">{t('admin.stats.loadFailed')}</div>;
  if (!stats) return <span className="loading loading-dots loading-sm m-4" />;

  const weeklyMax = Math.max(1, ...stats.weekly.map((w) => w.installs));
  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="stats stats-horizontal shadow-sm">
        {([['today', stats.today], ['d7', stats.d7], ['d30', stats.d30]] as const).map(([k, v]) => (
          <div key={k} className="stat p-3">
            <div className="stat-title text-xs">{t(`admin.stats.${k}`)}</div>
            <div className="stat-value text-2xl">{v}</div>
          </div>
        ))}
      </div>
      <p className="text-xs opacity-70">{t('admin.stats.installsNote')}</p>
      <section><h4 className="mb-1 text-sm font-semibold">{t('admin.stats.byFaculty')}</h4><StatsBars groups={stats.byFaculty} labelFor={label} under5={under5} /></section>
      <section><h4 className="mb-1 text-sm font-semibold">{t('admin.stats.byPlatform')}</h4><StatsBars groups={stats.byPlatform} labelFor={label} under5={under5} /></section>
      <section>
        <h4 className="mb-1 text-sm font-semibold">{t('admin.stats.weekly')}</h4>
        <svg viewBox="0 0 120 40" className="h-24 w-full text-primary" role="img" aria-label={t('admin.stats.weekly')}>
          {stats.weekly.map((w, i) => {
            const h = w.installs < 0 ? 2 : Math.max(1, Math.round((w.installs / weeklyMax) * 36));
            return <rect key={w.weekStart} x={i * 10 + 1} y={40 - h} width="8" height={h} rx="1" fill="currentColor" opacity={w.installs < 0 ? 0.3 : 1} />;
          })}
        </svg>
      </section>
      <button type="button" className="btn btn-ghost btn-xs self-end" onClick={() => void reload()} disabled={loading}>↻</button>
    </div>
  );
}
