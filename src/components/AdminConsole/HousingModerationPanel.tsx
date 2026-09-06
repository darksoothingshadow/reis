import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

// Loaded by the tab button that reveals it (see the consoles), never by an effect.
export function HousingModerationPanel() {
  const { t } = useTranslation();
  const rows = useAppStore((s) => s.adminHousing);
  const loading = useAppStore((s) => s.adminHousingLoading);
  const hide = useAppStore((s) => s.hideAdminHousing);
  const del = useAppStore((s) => s.deleteAdminHousing);
  const reload = useAppStore((s) => s.loadAdminHousing);

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('housing.title')}</h3>
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => void reload()} disabled={loading}>↻</button>
      </div>
      {rows.length === 0 && !loading && <div className="text-sm opacity-70">{t('housing.empty')}</div>}
      {rows.map((r) => (
        <div key={r.id} className={`card card-compact bg-base-200 ${r.hidden_by_admin ? 'opacity-60' : ''}`}>
          <div className="card-body gap-1 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">{t(`housing.kind.${r.kind}`)} · {r.district}</span>
              <span className="opacity-70">{r.is_login}{r.hidden_by_admin ? ` · ${t('admin.housingHidden')}` : ''}</span>
            </div>
            <div className="opacity-80">{r.contact}</div>
            {r.note && <div className="whitespace-pre-wrap">{r.note}</div>}
            <div className="card-actions justify-end">
              <button type="button" className="btn btn-outline btn-xs" onClick={() => void hide(r.id, !r.hidden_by_admin)}>
                {t(r.hidden_by_admin ? 'admin.housingUnhide' : 'admin.housingHide')}
              </button>
              <button type="button" className="btn btn-error btn-outline btn-xs" onClick={() => { if (window.confirm(t('admin.housingDelete') + '?')) void del(r.id); }}>
                {t('admin.housingDelete')}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
