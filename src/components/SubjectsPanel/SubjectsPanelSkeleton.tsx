/**
 * SubjectsPanelSkeleton
 *
 * Mirrors the visual structure of SubjectsPanel while data is loading:
 *  1. Header — title, IS MENDELU link stub, progression card stub
 *  2. Enrolled section — section label + 3 subject row stubs
 *  3. Study Plan section — section label + 4 collapsed semester accordion row stubs
 */
export function SubjectsPanelSkeleton() {
  return (
    <div className="h-full overflow-y-auto">
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-base-300">
        <div className="flex items-center justify-between mb-2">
          <div className="skeleton h-6 w-28 rounded" />
          <div className="skeleton h-7 w-24 rounded-lg" />
        </div>

        {/* Progression card stub */}
        <div className="rounded-lg border border-base-300 bg-base-200/30 px-3.5 py-2.5">
          <div className="flex items-center gap-2 mb-2">
            <div className="skeleton w-4 h-4 rounded-full shrink-0" />
            <div className="skeleton h-4 w-36 rounded" />
            <div className="skeleton h-3.5 w-20 rounded ml-auto" />
          </div>
          {/* Progress bar */}
          <div className="skeleton w-full h-1.5 rounded-full mb-2" />
          {/* Detail line */}
          <div className="skeleton h-3 w-40 rounded" />
        </div>
      </div>

      {/* ── Enrolled section ── */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-baseline justify-between mb-2">
          <div className="skeleton h-4 w-24 rounded" />
          <div className="skeleton h-3 w-16 rounded" />
        </div>

        <div className="rounded-lg border border-base-300 overflow-hidden p-1.5 flex flex-col gap-0.5">
          {[70, 55, 80].map((w, i) => (
            <SubjectRowSkeleton key={i} nameWidth={`${w}%`} />
          ))}
        </div>
      </div>

      {/* ── Study plan section ── */}
      <div className="px-4 pt-2 pb-4">
        <div className="skeleton h-4 w-24 rounded mb-3" />
        <div className="flex flex-col gap-2">
          {[
            { nameWidth: '55%', badge: 'w-10' },
            { nameWidth: '48%', badge: 'w-12' },
            { nameWidth: '60%', badge: 'w-9' },
            { nameWidth: '52%', badge: 'w-10' },
          ].map((row, i) => (
            <SemesterSectionSkeleton key={i} nameWidth={row.nameWidth} badgeWidth={row.badge} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Single subject row placeholder — name + fail-rate badge + credits */
function SubjectRowSkeleton({ nameWidth }: { nameWidth: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="skeleton h-4 rounded flex-1" style={{ maxWidth: nameWidth }} />
      <div className="skeleton h-5 w-10 rounded" />
      <div className="skeleton h-3.5 w-10 rounded" />
    </div>
  );
}

/** Collapsed semester accordion row placeholder */
function SemesterSectionSkeleton({
  nameWidth,
  badgeWidth,
}: {
  nameWidth: string;
  badgeWidth: string;
}) {
  return (
    <div className="rounded-lg border border-base-300 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="skeleton w-1 h-8 rounded-full shrink-0" />
        <div className="skeleton h-4 rounded flex-1" style={{ maxWidth: nameWidth }} />
        <div className={`skeleton h-5 ${badgeWidth} rounded shrink-0`} />
      </div>
    </div>
  );
}
