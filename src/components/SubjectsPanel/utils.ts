import type { SemesterBlock, StudyPlan } from '@/types/studyPlan';

export type SemesterState = 'past' | 'current' | 'future';

// IS Mendelu sentinel: 999 credits = "uznaný předmět", don't sum.
export const isRealCredits = (c: number) => c < 999;

// Zaměření pseudo-subjects are plan placeholders, not real courses.
const ZAMERANI_PREFIXES = ['EBC-ZB', 'EBA-ZB'];
export const isZameraniCode = (code: string) => ZAMERANI_PREFIXES.some((p) => code.startsWith(p));

export function getSemesterState(block: SemesterBlock): SemesterState {
  const all = block.groups.flatMap((g) => g.subjects);
  if (all.length === 0) return 'future';
  const hasEnrolled = all.some((s) => s.isEnrolled);
  if (hasEnrolled) return 'current';
  const isNotActivated =
    /neaktiv/i.test(block.title) || /not\s+(?:yet\s+|been\s+)?activated/i.test(block.title);
  if (isNotActivated) return 'future';
  const allFulfilled = all.every((s) => s.isFulfilled);
  if (allFulfilled) return 'past';
  const hasFulfilled = all.some((s) => s.isFulfilled);
  if (!hasFulfilled) return 'future';
  // Some fulfilled, some not — past only if unfulfilled subjects were attempted (enrollmentCount > 0).
  // Without that signal the semester is ambiguous (e.g. stale IDB before enrollment) → treat as current.
  const unfulfilledAttempted = all.some((s) => !s.isFulfilled && s.enrollmentCount > 0);
  return unfulfilledAttempted ? 'past' : 'current';
}

export function normalizeZameraniName(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/^zaměření:\s*/i, '')
      .replace(/^specialization:\s*/i, '')
      // IS's English wording. Without it a pick keyed on "scope: web application
      // development" never matches one keyed on "web application development".
      .replace(/^scope:\s*/i, '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim()
  );
}

// Reverse map: subject code → normalized names of zaměření that contain it.
// Subjects not in the map are mandatory or general electives (always visible).
export function buildSubjectToZameranis(plan: StudyPlan | null | undefined): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!plan?.zameranis) return map;
  for (const z of plan.zameranis) {
    const norm = normalizeZameraniName(z.name);
    for (const s of z.subjects) {
      const existing = map.get(s.code) ?? [];
      existing.push(norm);
      map.set(s.code, existing);
    }
  }
  return map;
}

export function buildSubjectSemesters(
  plan: { blocks: SemesterBlock[] } | null | undefined
): Map<string, string[]> {
  if (!plan) return new Map();
  const map = new Map<string, Set<number>>();
  for (const block of plan.blocks) {
    const numMatch = block.title.match(/^(\d+)/);
    if (!numMatch) continue;
    const num = Number(numMatch[1]);
    for (const g of block.groups)
      for (const s of g.subjects) {
        const existing = map.get(s.code) ?? new Set<number>();
        existing.add(num);
        map.set(s.code, existing);
      }
  }
  return new Map(
    [...map.entries()].map(([code, sems]) => [code, [...sems].sort((a, b) => a - b).map(String)])
  );
}

export function cleanGroupName(name: string): string {
  let cleaned = name
    .replace(/^(Skupina předmětů|Skupiny předmětů|Skupina)\s*(:|-)?\s*/i, '')
    .replace(/^(A group of courses|Groups of courses|A group of|Group)\s*(:|-)?\s*/i, '')
    .replace(/\s*\(\s*min\.?.*?\)\s*$/i, '')
    .trim();

  if (/^volitelných$/i.test(cleaned)) {
    cleaned = 'Volitelné';
  } else if (/^povinných$/i.test(cleaned)) {
    cleaned = 'Povinné';
  } else if (/^povinně volitelných$/i.test(cleaned) || /^povinně volitených$/i.test(cleaned)) {
    cleaned = 'Povinně volitelné';
  }

  if (!cleaned) return name;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// Winter semester: Sep 1 – Jan 31. Summer semester: Feb 1 – Aug 31.
// fulfillmentDate is DD.MM.YYYY in Czech (dot separator) but MM/DD/YYYY in
// English (slash separator, US month-first order) — verified against real
// IS Mendelu output for the same record: CZ "14.01.2026" == EN "01/14/2026".
export function isThisSemester(fulfillmentDate?: string): boolean {
  if (!fulfillmentDate) return false;
  const isSlash = fulfillmentDate.includes('/');
  const parts = fulfillmentDate.split(/[./]/);
  if (parts.length < 3) return false;
  const [a, b, year] = parts;
  const [day, month] = isSlash ? [b, a] : [a, b];
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const now = new Date();
  const isSummer = now.getMonth() >= 1 && now.getMonth() <= 7;
  const semStart = isSummer
    ? new Date(now.getFullYear(), 1, 1)
    : now.getMonth() >= 8
      ? new Date(now.getFullYear(), 8, 1)
      : new Date(now.getFullYear() - 1, 8, 1);
  return date >= semStart && date <= now;
}

export function shortenStatusText(text: string): string {
  if (!text) return '';
  const clean = text.trim();

  // Czech
  if (/^splněna$/i.test(clean)) return 'Splněno';

  // "nesplněna, chybí 5 předmětů" -> "Chybí 5 pr."
  // "nesplněna, chybí 12 kreditů" -> "Chybí 12 kr."
  const czMatch = clean.match(/nesplněna,\s*chybí\s*(\d+)\s*(předmět[ůye]*|kredit[ůye]*)/i);
  if (czMatch) {
    const num = czMatch[1];
    const unit = czMatch[2].toLowerCase();
    if (unit.startsWith('před')) return `Chybí ${num} pr.`;
    if (unit.startsWith('kred')) return `Chybí ${num} kr.`;
  }

  // English
  if (/^fulfilled$/i.test(clean)) return 'Fulfilled';
  const enMatch = clean.match(/not\s*fulfilled,\s*(\d+)\s*(courses?|credits?)\s*missing/i);
  if (enMatch) {
    const num = enMatch[1];
    const unit = enMatch[2].toLowerCase();
    if (unit.startsWith('cour')) return `${num} missing`;
    if (unit.startsWith('cred')) return `${num} cr. missing`;
  }

  // Fallbacks
  return clean
    .replace(/^nesplněna,\s*chybí\s*/i, 'Chybí ')
    .replace(/^not\s*fulfilled,\s*/i, 'Missing ');
}
