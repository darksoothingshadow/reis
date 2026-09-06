import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { EUROPE_PATHS } from '@/constants/europePaths';
import { ERASMUS_COUNTRIES } from '@/constants/erasmusCountries';
import { ERASMUS_COUNTRY_STATS } from '@/constants/erasmusCountryStats';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/store/useAppStore';
import { getGrantForCountryId } from '@/utils/erasmusGrants';

interface EuropeMapProps {
  selectedCountryId: string;
  onSelectCountry: (id: string) => void;
  lang: 'cs' | 'en';
}

function priceLevelColor(pli: number | null): string {
  if (pli == null) return 'oklch(var(--b3))';
  // Range 40 (Cheap) to 160 (Expensive). 100 is EU average.
  const t = Math.max(0, Math.min(1, (pli - 40) / 120));

  // Semantic Hue: 170 (Mint/Teal) -> 220 (Blue) -> 30 (Amber/Rose)
  // We want Lighter/Safe for Cheap, and Warm for Expensive.
  let hue = 170;
  if (t <= 0.5) {
    // 0 to 0.5: 170 to 220
    hue = 170 + t * 2 * 50;
  } else {
    // 0.5 to 1: 220 to 30 (crossing through 0/360 or just direct)
    // Actually, let's go 220 -> 300 -> 30? No, let's go 220 -> 360/0 -> 30.
    const t2 = (t - 0.5) * 2;
    hue = 220 + t2 * 170; // 220 + 170 = 390 (equivalent to 30)
  }

  // Consistent lightness to avoid "darkness" being interpreted as anything else
  const lightness = 72;
  const chroma = 0.08;
  return `oklch(${lightness}% ${chroma} ${hue % 360})`;
}

function ratingStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.3;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - (half ? 1 : 0));
}

interface TooltipData {
  name: string;
  countryId: string;
  x: number;
  y: number;
}

const BASE = [120, 0, 680, 519]; // Stage 3: Clipped left part (Atlantic)
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

export function EuropeMap({ selectedCountryId, onSelectCountry, lang }: EuropeMapProps) {
  const { t } = useTranslation();
  const erasmusConfig = useAppStore((s) => s.erasmusConfig);
  const erasmusIds = useMemo(() => new Set(ERASMUS_COUNTRIES.map((c) => c.id)), []);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Zoom/pan state: viewBox origin + size
  const [vb, setVb] = useState({ x: BASE[0], y: BASE[1], w: BASE[2], h: BASE[3] });
  const dragRef = useRef<{ startX: number; startY: number; vb: typeof vb } | null>(null);
  const didDragRef = useRef(false);

  const clampVb = useCallback((nx: number, ny: number, nw: number) => {
    const w = Math.max(BASE[2] / MAX_ZOOM, Math.min(BASE[2] / MIN_ZOOM, nw));
    const h = w * (BASE[3] / BASE[2]);
    const x = Math.max(BASE[0], Math.min(BASE[0] + BASE[2] - w, nx));
    const y = Math.max(BASE[1], Math.min(BASE[1] + BASE[3] - h, ny));
    return { x, y, w, h };
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // Mouse position as fraction of SVG element
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;

    const step = 1 + Math.min(Math.abs(e.deltaY), 100) * 0.002;
    const factor = e.deltaY > 0 ? step : 1 / step;
    setVb((prev) => {
      const nw = prev.w * factor;
      // Zoom toward mouse position
      // Clamp size first, then adjust origin proportionally
      const cw = Math.max(BASE[2] / MAX_ZOOM, Math.min(BASE[2], nw));
      const ch = cw * (BASE[3] / BASE[2]);
      const cx = prev.x + (prev.w - cw) * mx;
      const cy = prev.y + (prev.h - ch) * my;
      return {
        w: cw,
        h: ch,
        x: Math.max(BASE[0], Math.min(BASE[0] + BASE[2] - cw, cx)),
        y: Math.max(BASE[1], Math.min(BASE[1] + BASE[3] - ch, cy)),
      };
    });
    setTooltip(null);
  }, []);

  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(300);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      (e.target as Element).setPointerCapture(e.pointerId);
      dragRef.current = { startX: e.clientX, startY: e.clientY, vb: { ...vb } };
      didDragRef.current = false;
      setIsDragging(true);
    },
    [vb]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const dx = ((e.clientX - dragRef.current.startX) / rect.width) * dragRef.current.vb.w;
      const dy = ((e.clientY - dragRef.current.startY) / rect.height) * dragRef.current.vb.h;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDragRef.current = true;
      setVb(clampVb(dragRef.current.vb.x - dx, dragRef.current.vb.y - dy, dragRef.current.vb.w));
      setTooltip(null);
    },
    [clampVb]
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleMouseEnter = useCallback(
    (id: string, e: React.MouseEvent) => {
      const country = ERASMUS_COUNTRIES.find((c) => c.id === id);
      if (!country || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setTooltip({
        name: country[lang],
        countryId: id,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    [lang]
  );

  const handleMouseMoveTooltip = useCallback(
    (e: React.MouseEvent) => {
      if (!tooltip || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setTooltip((prev) =>
        prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : null
      );
    },
    [tooltip]
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const handleCountryClick = useCallback(
    (id: string) => {
      if (!didDragRef.current) onSelectCountry(id);
    },
    [onSelectCountry]
  );

  const isZoomed = vb.w < BASE[2] - 1;

  const stats = tooltip ? ERASMUS_COUNTRY_STATS[tooltip.countryId] : null;

  const top3 = useMemo(() => {
    return Object.entries(ERASMUS_COUNTRY_STATS)
      .map(([id, s]) => ({ id, count: s.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((item) => {
        const country = ERASMUS_COUNTRIES.find((c) => c.id === item.id);
        return {
          id: item.id,
          name: country ? country[lang] : item.id,
          count: item.count,
        };
      });
  }, [lang]);

  const totalReports = useMemo(
    () => Object.values(ERASMUS_COUNTRY_STATS).reduce((acc, s) => acc + s.count, 0),
    []
  );

  return (
    <div className="flex h-full gap-4 p-1 overflow-hidden">
      {/* Map column */}
      <div ref={containerRef} className="relative flex-1" onMouseMove={handleMouseMoveTooltip}>
        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="w-full h-full"
          role="img"
          aria-label="Europe map"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        >
          <style>{`
            .erasmus-country { transition: opacity 0.15s; }
            .erasmus-country:hover { opacity: 0.75; }
          `}</style>
          {/* Country fills with background-colored stroke for border gaps */}
          {EUROPE_PATHS.map(({ id, d }) => {
            const isBackground = id.startsWith('BG_');
            if (isBackground) return null;

            const isErasmus = erasmusIds.has(id);
            const pathStats = ERASMUS_COUNTRY_STATS[id];
            const isSelected = id === selectedCountryId;
            const opacity = selectedCountryId ? (isSelected ? 0 : 0.4) : 1;

            const fill =
              isErasmus && pathStats
                ? priceLevelColor(pathStats.priceLevelIndex)
                : 'oklch(var(--b3))';

            return (
              <path
                key={id}
                d={d}
                fill={fill}
                fillRule="evenodd"
                stroke="rgba(0,0,0,0.25)"
                strokeWidth={1.5}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                paintOrder="stroke"
                className={isErasmus ? 'erasmus-country cursor-pointer' : ''}
                onClick={isErasmus ? () => handleCountryClick(id) : undefined}
                onMouseEnter={isErasmus ? (e) => handleMouseEnter(id, e) : undefined}
                onMouseLeave={isErasmus ? handleMouseLeave : undefined}
                aria-label={
                  isErasmus ? ERASMUS_COUNTRIES.find((c) => c.id === id)?.[lang] : undefined
                }
                opacity={opacity}
                style={{ transition: 'opacity 0.3s' }}
              />
            );
          })}

          {/* Special effects for selected country (Stage 1) - Rendered on TOP */}
          {selectedCountryId &&
            (() => {
              const path = EUROPE_PATHS.find((p) => p.id === selectedCountryId);
              if (!path) return null;
              const s = ERASMUS_COUNTRY_STATS[path.id];
              const fill = s ? priceLevelColor(s.priceLevelIndex) : 'oklch(var(--b3))';

              return (
                <g className="pointer-events-none">
                  {/* Layer 1: Stark White Outline (Base contrast) */}
                  <path d={path.d} fill="none" stroke="white" strokeWidth={5} fillRule="evenodd" />
                  {/* Layer 2: Primary Core (Creates the colored edge) */}
                  <path
                    d={path.d}
                    fill="none"
                    stroke="oklch(var(--p))"
                    strokeWidth={3}
                    fillRule="evenodd"
                  />
                  {/* Layer 3: The Fill (Ensures stroke only shows OUTWARDS) */}
                  <path d={path.d} fill={fill} fillRule="evenodd" />
                </g>
              );
            })()}

          {/* Vertical separator line (Stage 3) */}
          <line x1="120" y1="0" x2="120" y2="519" stroke="oklch(var(--b3))" strokeWidth="1" />
        </svg>

        {/* Reset zoom button */}
        {isZoomed && (
          <button
            onClick={() => setVb({ x: BASE[0], y: BASE[1], w: BASE[2], h: BASE[3] })}
            className="absolute top-2 right-2 btn btn-xs btn-ghost bg-base-100/80 border border-base-300"
          >
            Reset
          </button>
        )}

        {tooltip && stats && (
          <div
            className="absolute z-50 pointer-events-none bg-base-100 border border-base-300 rounded-lg shadow-lg px-3 py-2.5 w-52 text-xs"
            style={{
              left: Math.min(tooltip.x + 12, containerWidth - 220),
              top: tooltip.y - 8,
              transform: 'translateY(-100%)',
            }}
          >
            <div className="font-bold text-sm mb-1.5">{tooltip.name}</div>
            <div className="flex items-center gap-1 text-warning mb-1">
              <span>{ratingStars(stats.avgRating)}</span>
              <span className="text-base-content/60 ml-1">{stats.avgRating}</span>
            </div>
            {stats.priceLevelIndex != null && (
              <div className="text-base-content/70">
                {t('erasmus.priceLevel')}:{' '}
                <span className="font-semibold text-base-content">{stats.priceLevelIndex}</span>{' '}
                <span className="text-base-content/70">EU=100</span>
              </div>
            )}
            {erasmusConfig &&
              (() => {
                const grant = getGrantForCountryId(erasmusConfig, tooltip.countryId);
                return grant ? (
                  <div className="text-success font-semibold mt-0.5">
                    {t('erasmus.grantPerMonth', { amount: grant })}
                  </div>
                ) : null;
              })()}
          </div>
        )}
      </div>

      {/* Legend & Stats column (Stage 2) */}
      <div className="w-56 shrink-0 flex flex-col gap-8 py-3 pr-4">
        {/* Price Level Legend */}
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-xs font-bold opacity-40 uppercase tracking-widest">
              {t('erasmus.legend')}
            </h3>
            <span className="text-[10px] opacity-40 font-bold whitespace-nowrap">
              {totalReports} {t('erasmus.reports')}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full ring-1 ring-base-content/10 shadow-sm"
                style={{ backgroundColor: priceLevelColor(160) }}
              />
              <span className="text-sm font-medium text-base-content/80">
                {t('erasmus.higherPrices')}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full ring-1 ring-base-content/10 shadow-sm"
                style={{ backgroundColor: priceLevelColor(40) }}
              />
              <span className="text-sm font-medium text-base-content/80">
                {t('erasmus.lowerPrices')}
              </span>
            </div>
            <p className="text-[10px] text-base-content/70 italic leading-tight pl-0.5">
              {t('erasmus.legendDesc')}
            </p>
          </div>
        </div>

        {/* Top 3 Stats */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold opacity-40 uppercase tracking-widest">
            {t('erasmus.topDestinations')}
          </h3>
          <ul className="flex flex-col gap-3 list-none p-0 m-0">
            {top3.map((item) => (
              <li key={item.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold truncate max-w-[140px]">{item.name}</span>
                  <span className="text-xs opacity-60 font-mono whitespace-nowrap">
                    ({item.count} {t('erasmus.reports')})
                  </span>
                </div>
                {/* Visual indicator (optional bar) */}
                <div className="w-full h-1.5 bg-base-300 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/40"
                    style={{ width: `${(item.count / top3[0].count) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
