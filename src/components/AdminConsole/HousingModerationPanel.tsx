import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
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

  // Delete is a two-step, in-row arm/commit, same as AdminEventList: the
  // panel renders inside a sandboxed iframe (see src/injector/iframeManager.ts)
  // whose sandbox has no allow-modals, so a native browser dialog is silently
  // a no-op there and can never gate the delete. `armedId` tracks which row's
  // delete button was tapped once; a second tap on that same row commits,
  // tapping delete on any other row (or cancelling) disarms it.
  const [armedId, setArmedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('housing.title')}</h3>
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => void reload()} disabled={loading}>↻</button>
      </div>
      {rows.length === 0 && !loading && <div className="text-sm opacity-70">{t('housing.empty')}</div>}
      {rows.map((r) => (
        // border-base-content/10: bg-base-200 sits directly on the base-100
        // wrapper (desktop aside and the mobile housing pane both) — 1.03:1
        // in the light theme, effectively invisible (same case fixed on
        // HousingBoard's tabs-box and MyHousingPosts elsewhere in this PR).
        <div key={r.id} className={`card card-compact border border-base-content/10 bg-base-200 ${r.hidden_by_admin ? 'opacity-60' : ''}`}>
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
              {armedId === r.id ? (
                <>
                  {/* text-black: DaisyUI's error-content (white) on
                      --color-error is 3.76:1 in both themes — below the
                      4.5:1 AA floor a btn-xs label needs, and this button's
                      own text IS the confirm action, so there is no icon to
                      carry the colour instead (contrast the outline variant
                      above). Black on the same red is 5.58:1. */}
                  <button
                    type="button"
                    className="btn btn-error btn-xs text-black"
                    onClick={() => { setArmedId(null); void del(r.id); }}
                  >
                    {t('admin.housingDelete')}?
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs px-1.5"
                    aria-label={t('common.cancel')}
                    onClick={() => setArmedId(null)}
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                // btn-outline btn-error colours the LABEL red too — #ef4444
                // on base-100 is 3.90:1 in the light theme, below the 4.5:1
                // AA floor (see the comment on the test above). The danger
                // cue moves to the icon; the label itself stays full-opacity
                // base-content, which is what the outline border alone
                // cannot signal on its own but the icon does.
                <button type="button" className="btn btn-outline btn-xs gap-1" onClick={() => setArmedId(r.id)}>
                  <Trash2 size={12} className="text-error" aria-hidden="true" />
                  {t('admin.housingDelete')}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
