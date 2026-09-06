import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

export function MyHousingPosts() {
  const { t } = useTranslation();
  const mineIds = useAppStore((s) => s.housingMineIds);
  const posts = useAppStore((s) => s.housingPosts);
  const closeHousing = useAppStore((s) => s.closeHousing);
  const mine = posts.filter((p) => mineIds.includes(p.id));
  if (mineIds.length === 0) return null;
  // border-base-content/10: bg-base-200 sits directly on the sheet's
  // base-100 backdrop — 1.03:1 in the light theme, effectively invisible
  // (same case as HousingBoard's tabs-box, see the comment there).
  return (
    <div className="rounded-box border border-base-content/10 bg-base-200 p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider opacity-60">{t('housing.mine')}</div>
      {mine.length === 0 && <div className="text-sm opacity-70">{t('housing.noMine')}</div>}
      {mine.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-2 py-1 text-sm">
          <span>{t(`housing.kind.${p.kind}`)} · {p.district}</span>
          <button type="button" className="btn btn-outline btn-xs" onClick={() => void closeHousing(p.id)}>{t('housing.close')}</button>
        </div>
      ))}
    </div>
  );
}
