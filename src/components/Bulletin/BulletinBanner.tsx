import { useEffect, useRef } from 'react';
import { Pin, ExternalLink, X, ArrowUpRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { MobileBulletinOverlay } from './MobileBulletinOverlay';

const VYVESKA_URL = 'https://is.mendelu.cz/auth/vyveska/nove_prispevky.pl?zalozka=2';

const DOT_COLOR: Record<string, string> = {
  Ubytování: 'bg-info',
  Housing: 'bg-info',
  Inzerce: 'bg-primary',
  Notice: 'bg-primary',
  Nabízím: 'bg-success',
  Offered: 'bg-success',
  Prodám: 'bg-success',
  Hledám: 'bg-warning',
  Wanted: 'bg-warning',
  Koupím: 'bg-warning',
  Ostatní: 'bg-base-content/40',
  Other: 'bg-base-content/40',
};

function dotColor(cat: string | undefined): string {
  if (!cat) return 'bg-base-content/40';
  return DOT_COLOR[cat] ?? 'bg-base-content/40';
}

export function BulletinBanner({ inline = false }: { inline?: boolean }) {
  const { t } = useTranslation();
  const isMobile = useAppStore((s) => s.isNarrow);
  const posts = useAppStore((s) => s.bulletinPosts);
  const expanded = useAppStore((s) => s.bulletinExpanded);
  const loading = useAppStore((s) => s.bulletinLoading);
  const error = useAppStore((s) => s.bulletinError);
  const hydrated = useAppStore((s) => s.bulletinHydrated);
  const setExpanded = useAppStore((s) => s.setBulletinExpanded);
  const loadIfStale = useAppStore((s) => s.loadBulletinIfStale);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevIsMobile = useRef(isMobile);

  useEffect(() => {
    // Wait until hydrate finishes before consulting the cache; otherwise a
    // user click during the hydrate microtask fires loadIfStale against
    // default state (fetchedAt=null) and races the IDB-restored values.
    if (expanded && hydrated) void loadIfStale();
  }, [expanded, hydrated, loadIfStale]);

  // Collapse on viewport handoff so a rotate/resize doesn't auto-open the
  // dropdown or overlay in the other surface without an explicit user gesture.
  useEffect(() => {
    if (prevIsMobile.current !== isMobile) {
      prevIsMobile.current = isMobile;
      if (expanded) void setExpanded(false);
    }
  }, [isMobile, expanded, setExpanded]);

  useEffect(() => {
    if (!expanded || isMobile) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        void setExpanded(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        void setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [expanded, isMobile, setExpanded]);

  if (!inline) return null;

  if (isMobile) {
    return (
      <div className="flex-1 flex items-center min-w-0 px-3">
        <button
          type="button"
          onClick={() => {
            void setExpanded(true);
          }}
          aria-label={t('bulletin.expand')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-base-100 border border-base-300 rounded-lg hover:bg-base-200 transition-colors"
        >
          <Pin className="w-3 h-3 text-primary flex-shrink-0" />
          <span className="text-xs font-semibold text-base-content whitespace-nowrap">
            {t('bulletin.title')}
          </span>
        </button>
        <MobileBulletinOverlay
          isOpen={expanded}
          onClose={() => {
            void setExpanded(false);
          }}
          posts={posts}
          loading={loading}
          error={error}
        />
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex items-center min-w-0 px-3" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          void setExpanded(!expanded);
        }}
        aria-label={expanded ? t('bulletin.collapse') : t('bulletin.expand')}
        className={`flex items-center gap-1.5 px-3 py-1.5 bg-base-100 border border-base-300 rounded-lg hover:bg-base-200 transition-all ${
          expanded ? 'bg-base-200/80 border-primary/40 text-primary' : ''
        }`}
      >
        <Pin className="w-3 h-3 text-primary flex-shrink-0" />
        <span className="text-xs font-semibold text-base-content whitespace-nowrap">
          {t('bulletin.title')}
        </span>
      </button>

      {expanded && (
        <div className="absolute left-3 top-11 z-50 w-96 bg-base-100 border border-base-300 rounded-xl shadow-xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-base-300/80 bg-base-200/40">
            <div className="flex items-center gap-2">
              <Pin className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold text-base-content">{t('bulletin.title')}</span>
            </div>
            <div className="flex items-center gap-1">
              <a
                href={VYVESKA_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('bulletin.showAll')}
                title={t('bulletin.showAll')}
                className="p-1 hover:bg-base-300 rounded-lg text-base-content/40 hover:text-primary transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => {
                  void setExpanded(false);
                }}
                aria-label={t('bulletin.collapse')}
                className="p-1 hover:bg-base-300 rounded-lg text-base-content/40 hover:text-base-content/85 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-base-300/50">
            {loading && posts.length === 0 && (
              <div className="p-4 text-center text-xs text-base-content/50">
                {t('bulletin.loading')}
              </div>
            )}
            {!loading && error && posts.length === 0 && (
              <div className="p-4 text-center text-xs text-error/85">{t('bulletin.error')}</div>
            )}
            {!loading && !error && posts.length === 0 && (
              <div className="p-4 text-center text-xs text-base-content/50">
                {t('bulletin.empty')}
              </div>
            )}
            {posts.map((post, i) => {
              const cat = post.categories[post.categories.length - 1] ?? post.categories[0];
              return (
                <a
                  key={`${post.url}-${i}`}
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={cat ? `${post.title} · ${cat}` : post.title}
                  className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-base-200/50 transition-colors group/post"
                >
                  <span
                    className={`w-1.5 h-1.5 mt-1.5 rounded-full flex-shrink-0 transition-transform group-hover/post:scale-125 ${dotColor(cat)}`}
                  />
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    {cat && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-base-content/40">
                        {cat}
                      </span>
                    )}
                    <span className="text-xs font-medium text-base-content/80 group-hover/post:text-base-content leading-snug transition-colors line-clamp-2">
                      {post.title}
                    </span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 mt-2 text-base-content/30 opacity-0 group-hover/post:opacity-100 group-hover/post:translate-x-0.5 transition-all duration-200 flex-shrink-0" />
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
