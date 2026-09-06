import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { submitSuggestion } from '../../api/suggestions';
import type { HousingKind, HousingPost } from '../../types/housing';
import { HousingCard } from './HousingCard';
import { HousingForm } from './HousingForm';
import { MyHousingPosts } from './MyHousingPosts';

/**
 * The board itself, hosted by HousingSheet (phone) and HousingPanel (desktop).
 * `onVerify` differs per host: the phone pushes the person sheet, the desktop
 * opens the IS person page. Loading is a slice action fired once on mount —
 * the effect only *calls* the store, it does not fetch.
 */
export function HousingBoard({ onVerify }: { onVerify: (post: HousingPost) => void }) {
  const { t } = useTranslation();
  const posts = useAppStore((s) => s.housingPosts);
  const loaded = useAppStore((s) => s.housingLoaded);
  const loading = useAppStore((s) => s.housingLoading);
  const loadHousing = useAppStore((s) => s.loadHousing);
  const [tab, setTab] = useState<HousingKind>('offer');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    void loadHousing();
  }, [loadHousing]);

  const report = async (post: HousingPost): Promise<boolean> => {
    // Moderation reuses the suggestions inbox: no new plumbing, admins already read it.
    const res = await submitSuggestion({
      type: 'other',
      title: `[housing] ${post.id}`,
      body: `${post.kind} · ${post.district}`,
    });
    return res.ok;
  };

  if (adding) return <HousingForm onDone={() => setAdding(false)} />;

  const visible = posts.filter((p) => p.kind === tab);
  return (
    <div className="relative flex h-full flex-col gap-3 p-3">
      {/* border-base-content/10: tabs-box's own base-200 background sits
          directly on this sheet's base-100 backdrop — 1.03:1 in the light
          theme, effectively invisible. text-base-content on the inactive tab
          overrides DaisyUI's default 60%-opacity label, which measures
          3.37:1 there (below the 4.5:1 AA floor). */}
      <div role="tablist" className="tabs tabs-box tabs-sm shrink-0 border border-base-content/10">
        {(['offer', 'request'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className={`tab flex-1 ${tab === k ? 'tab-active font-semibold' : 'text-base-content'}`}
            onClick={() => setTab(k)}
          >
            {t(k === 'offer' ? 'housing.tabOffer' : 'housing.tabRequest')}
          </button>
        ))}
      </div>
      <MyHousingPosts />
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-16">
        {!loaded && !loading && (
          <div className="alert alert-warning py-2 text-sm">{t('housing.loadFailed')}</div>
        )}
        {loading && posts.length === 0 && (
          <span className="loading loading-dots loading-sm self-center" />
        )}
        {loaded && visible.length === 0 && (
          <div className="py-8 text-center text-sm opacity-70">{t('housing.empty')}</div>
        )}
        {visible.map((p) => (
          <HousingCard key={p.id} post={p} onVerify={onVerify} onReport={report} />
        ))}
      </div>
      <button
        type="button"
        className="btn btn-primary btn-circle absolute bottom-4 right-4 shadow-lg"
        aria-label={t('housing.add')}
        onClick={() => setAdding(true)}
      >
        <Plus size={20} />
      </button>
    </div>
  );
}
