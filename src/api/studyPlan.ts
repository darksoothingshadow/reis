import { fetchWithAuth, BASE_URL } from './client';
import { parseRequiredInt, parseOptionalInt, ParserError } from '../utils/parsers/parserGuards';
import { logError } from '../utils/reportError';
import type {
  StudyPlan,
  DualLanguageStudyPlan,
  SemesterBlock,
  SubjectGroup,
  SubjectStatus,
  Zamerani,
  ZamerangSubjectRef,
} from '../types/studyPlan';

const STUDY_PLAN_URL = `${BASE_URL}/auth/studijni/studijni_povinnosti.pl`;

type Lang = 'cz' | 'en';

interface LangConstants {
  planNotFulfilled: string;
  creditsLabel: string;
  creditsRegex: RegExp;
  semesterPattern: RegExp;
  wholeplanGroups: string[];
  groupPrefix: string;
  noSubjectsMessage: string;
  fulfilledStatus: string;
  enrolledStatus: string;
  notEnrolledStatus: string;
  dateRegex: RegExp;
  fallbackGroupName: string;
}

const LANG: Record<Lang, LangConstants> = {
  cz: {
    planNotFulfilled: 'Studijní plán není dosud splněn',
    creditsLabel: 'Kredity:',
    creditsRegex: /(\d+)\s+získaných.*?ze\s+(\d+)\s+povinných/,
    semesterPattern: /\d+\.\s+semestr/i,
    wholeplanGroups: [
      'Skupiny předmětů pro celý plán',
      'Volitelné předměty za celé období daného studia',
    ],
    groupPrefix: 'Skupina předmětů',
    noSubjectsMessage: 'V tomto semestru nejsou doporučené předměty',
    fulfilledStatus: 'SPLNĚNO',
    enrolledStatus: 'ZAPSÁNO',
    notEnrolledStatus: 'NEZAPSÁNO',
    dateRegex: /(\d{2}\.\d{2}\.\d{4})/,
    fallbackGroupName: 'Ostatní předměty',
  },
  en: {
    planNotFulfilled: 'The study plan has not been completed yet',
    creditsLabel: 'Credits:',
    creditsRegex: /(\d+)\s+obtained.*?(?:of|out of)\s+(\d+)\s+of compulsory/,
    semesterPattern: /\d+\w*\s+semester/i,
    wholeplanGroups: [
      'Groups of courses for the entire plan',
      'Optional courses for the whole period of the given study',
    ],
    groupPrefix: 'A group of',
    noSubjectsMessage: 'There are no recommended subjects in this semester',
    fulfilledStatus: 'FULFILLED',
    enrolledStatus: 'ENROLLED',
    notEnrolledStatus: 'NOT ENROLLED',
    dateRegex: /(\d{2}\/\d{2}\/\d{4})/,
    fallbackGroupName: 'Other courses',
  },
};

export async function fetchDualLanguageStudyPlan(
  studium: string
): Promise<DualLanguageStudyPlan | null> {
  try {
    const [czRes, enRes] = await Promise.all([
      fetchWithAuth(`${STUDY_PLAN_URL}?studium=${studium};lang=cz`),
      fetchWithAuth(`${STUDY_PLAN_URL}?studium=${studium};lang=en`),
    ]);

    const [czHtml, enHtml] = await Promise.all([czRes.text(), enRes.text()]);
    const parser = new DOMParser();

    const czPlan = parseStudyPlanDOM(parser.parseFromString(czHtml, 'text/html'), 'cz');
    const enPlan = parseStudyPlanDOM(parser.parseFromString(enHtml, 'text/html'), 'en');

    return { cz: czPlan, en: borrowZameranisFromCz(enPlan, czPlan) };
  } catch (e) {
    logError('Api.fetchDualLanguageStudyPlan', e);
    return null;
  }
}

function extractPlanTitle(doc: Document): string {
  const fontEls = doc.querySelectorAll('font[size="+1"]');
  for (const el of fontEls) {
    const text = (el.textContent || '').trim();
    if (/[A-Z]-\w+.*[ZW]S\s+\d{4}/.test(text)) return text;
  }
  const boldEls = doc.querySelectorAll('b');
  for (const el of boldEls) {
    const text = (el.textContent || '').trim();
    if (/[A-Z]-\w+.*[ZW]S\s+\d{4}/.test(text)) return text;
  }
  return 'Study Plan';
}

/**
 * IS does not translate the zaměření section, so take the Czech one.
 *
 * Verified against real lang=cz and lang=en pages (2026-09-05, fixtures in
 * `src/api/__tests__/fixtures/`): the ENGLISH study plan carries the Czech
 * paragraph verbatim — "Studijní plán zaměření ZBOI obsahuje níže uvedené
 * předměty…" — followed by the same Czech <ul>. The English parse therefore
 * finds no list and every zaměření comes back with zero subjects and no
 * description, which is what a student in English mode saw: five rows that
 * expanded onto nothing.
 *
 * The Czech names ARE the ones IS itself prints on the English page, so
 * borrowing the whole Czech list is not a workaround for a parser bug — it is
 * the only content that exists. Deliberately NOT done by teaching the English
 * parse the Czech anchor: that yields nine entries, because the plan table also
 * contributes five English-named pseudo-rows that no longer match the Czech
 * names, and one of them silently adopts another zaměření's subjects.
 *
 * Guarded both ways. If English ever gains its own list, its entries have
 * subjects and nothing is borrowed; if Czech has nothing to give, English is
 * left exactly as parsed.
 */
export function borrowZameranisFromCz(en: StudyPlan, cz: StudyPlan): StudyPlan {
  const enZ = en.zameranis ?? [];
  const czZ = cz.zameranis ?? [];
  const enHasContent = enZ.some((z) => z.subjects.length > 0 || z.description);
  const czHasContent = czZ.some((z) => z.subjects.length > 0 || z.description);
  if (enHasContent || !czHasContent) return en;
  return { ...en, zameranis: czZ };
}

export function parseStudyPlanDOM(doc: Document, lang: Lang): StudyPlan {
  const L = LANG[lang];
  const bodyText = doc.body.textContent || '';
  const isFulfilled = !bodyText.includes(L.planNotFulfilled);

  let creditsAcquired = 0;
  let creditsRequired = 0;

  const allTds = Array.from(doc.querySelectorAll('td'));
  for (const td of allTds) {
    if (td.textContent && td.textContent.includes(L.creditsLabel)) {
      const parentRow = td.parentElement;
      if (parentRow) {
        const creditText = (parentRow.textContent || '').replace(/\s+/g, ' ');
        const match = creditText.match(L.creditsRegex);
        if (match) {
          try {
            creditsAcquired = parseRequiredInt(match[1], 'creditsAcquired', 'parseStudyPlanDOM');
            creditsRequired = parseRequiredInt(match[2], 'creditsRequired', 'parseStudyPlanDOM');
          } catch (e) {
            if (e instanceof ParserError) {
              logError('Parser.parseStudyPlanDOM', e, { lang, snippet: creditText.slice(0, 200) });
            } else throw e;
          }
        }
      }
      break;
    }
  }

  const blocks: SemesterBlock[] = [];
  let currentBlock: SemesterBlock | null = null;
  let currentGroup: SubjectGroup | null = null;

  const table = doc.getElementById('tmtab_1') || doc;
  const rows = Array.from(table.querySelectorAll('tr'));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = Array.from(row.querySelectorAll('td'));

    if (cells.length === 2 && (row.textContent || '').trim() === '') continue;

    const boldEls = row.querySelectorAll('b');
    const boldText = boldEls.length > 0 ? (boldEls[0].textContent || '').trim() : '';

    if (boldText.match(L.semesterPattern) || L.wholeplanGroups.includes(boldText)) {
      const isPool = L.wholeplanGroups.includes(boldText);
      currentBlock = { title: boldText, groups: [], isWholePlanPool: isPool };
      blocks.push(currentBlock);
      currentGroup = null;
      continue;
    }

    if (boldText.startsWith(L.groupPrefix)) {
      const rawText = (row.textContent || '').trim();
      let name = boldText;
      let statusDesc = '';

      if (rawText.includes('-')) {
        const parts = rawText.split('-');
        name = parts[0].trim();
        statusDesc = parts.slice(1).join('-').trim();
      } else {
        statusDesc = rawText;
      }

      const constraint = parseGroupConstraint(name);
      currentGroup = {
        name,
        statusDescription: statusDesc,
        subjects: [],
        ...(constraint.minCount !== undefined ? { minCount: constraint.minCount } : {}),
        ...(constraint.minCredits !== undefined ? { minCredits: constraint.minCredits } : {}),
      };
      if (currentBlock) {
        currentBlock.groups.push(currentGroup);
      }
      continue;
    }

    if (row.classList.contains('predmety_vse') || row.classList.contains('uis-hl-table')) {
      if ((row.textContent || '').includes(L.noSubjectsMessage)) continue;

      const visibleCells = cells.filter(
        (cell) => !cell.classList.contains('UISTMNumberCellHidden')
      );

      if (visibleCells.length >= 6) {
        const codeCell = visibleCells[0];
        const nameCell = visibleCells[1];
        const typeCell = visibleCells[2];
        const creditsCell = visibleCells[3];
        const enrolledCell = visibleCells[4];
        const statusCell = visibleCells[5];

        const codeHtml = codeCell.innerHTML || '';
        const idMatch = codeHtml.match(/predmet=(\d+)/);
        const id = idMatch ? idMatch[1] : '';

        const nameNode = nameCell.cloneNode(true) as Element;
        const favLinks = nameNode.querySelectorAll('a[href^="javascript:favourite"]');
        for (let j = 0; j < favLinks.length; j++) favLinks[j].remove();
        const cleanName = (nameNode.textContent || '').trim();

        const rawStatus = (statusCell.textContent || '').trim();
        const subjectFulfilled = rawStatus.includes(L.fulfilledStatus);
        const isEnrolled =
          rawStatus.includes(L.enrolledStatus) && !rawStatus.includes(L.notEnrolledStatus);

        let fulfillmentDate = undefined;
        if (subjectFulfilled) {
          const dateMatch = rawStatus.match(L.dateRegex);
          if (dateMatch) fulfillmentDate = dateMatch[1];
        }

        const subject: SubjectStatus = {
          id,
          code: (codeCell.textContent || '').trim(),
          name: cleanName,
          type: (typeCell.textContent || '').trim(),
          credits:
            parseOptionalInt(
              (creditsCell.textContent || '').trim(),
              'subject.credits',
              'parseStudyPlanDOM'
            ) ?? 0,
          enrollmentCount:
            parseOptionalInt(
              (enrolledCell.textContent || '').replace(/x/i, '').trim(),
              'subject.enrollmentCount',
              'parseStudyPlanDOM'
            ) ?? 0,
          isEnrolled,
          isFulfilled: subjectFulfilled,
          rawStatusText: rawStatus,
          fulfillmentDate,
        };

        if (!currentGroup && currentBlock) {
          currentGroup = { name: L.fallbackGroupName, statusDescription: '', subjects: [] };
          currentBlock.groups.push(currentGroup);
        }

        if (currentGroup) {
          currentGroup.subjects.push(subject);
        }
      }
    }
  }

  const zameranis = extractZameranis(doc, lang);
  const descriptions = extractZameraniDescriptions(doc, lang);
  if (descriptions.size > 0) {
    for (const z of zameranis) {
      const key = normalizeZameraniName(z.name);
      const desc = descriptions.get(key);
      if (desc) z.description = desc;
    }
  }

  // The <ul> description section may omit zaměření whose <li> lacks a <strong>
  // tag (e.g. "zahraniční mobilita" — its <li> is plain prose with a code range).
  // Recover name from pseudo-subject rows in the plan table; subjects from the
  // no-<strong> <li> items in the same <ul>, matched in appearance order.
  const orphanSubjects = extractUnnamedZameraniSubjects(doc, lang);
  const existingNorms = new Set(zameranis.map((z) => normalizeZameraniName(z.name)));
  for (const block of blocks)
    for (const group of block.groups)
      for (const s of group.subjects) {
        const isZbCode = s.code.startsWith('EBC-ZB') || s.code.startsWith('EBA-ZB');
        if (!isZbCode) continue;
        const norm = normalizeZameraniName(s.name);
        if (existingNorms.has(norm)) continue;
        existingNorms.add(norm);
        const clean = s.name
          .replace(/^zaměření:\s*/i, '')
          .replace(/^specialization:\s*/i, '')
          .trim();
        zameranis.push({
          name: clean.charAt(0).toUpperCase() + clean.slice(1),
          subjects: orphanSubjects.shift() ?? [],
        });
      }

  return {
    title: extractPlanTitle(doc),
    isFulfilled,
    creditsAcquired,
    creditsRequired,
    blocks,
    zameranis,
    zameraniMinimum: extractZameraniMinimum(doc, lang),
  };
}

// Parse "(min. 2 př.)" / "(min. 6 kr.)" from group names — language-agnostic for numbers.
function parseGroupConstraint(groupName: string): { minCount?: number; minCredits?: number } {
  const countMatch = groupName.match(/min\.?\s*(\d+)\s*př/i);
  if (countMatch) return { minCount: parseInt(countMatch[1], 10) };
  const creditMatch = groupName.match(/min\.?\s*(\d+)\s*(?:kr|cr)/i);
  if (creditMatch) return { minCredits: parseInt(creditMatch[1], 10) };
  return {};
}

function normalizeZameraniName(s: string): string {
  return s
    .toLowerCase()
    .replace(/^zaměření:\s*/i, '')
    .replace(/^specialization:\s*/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Legenda hidden block contains a second <ul> where each <li><strong>name</strong>: description
// paragraph describes the zaměření. Anchor: "Zaměření obsažená ve studijním plánu" (cz).
function extractZameraniDescriptions(doc: Document, lang: Lang): Map<string, string> {
  const out = new Map<string, string>();
  const anchor =
    lang === 'cz' ? 'Zaměření obsažená ve studijním' : 'specializations included in the study';
  const paragraphs = Array.from(doc.querySelectorAll('p'));
  let ul: Element | null = null;
  for (const p of paragraphs) {
    const txt = (p.textContent || '').trim();
    if (!txt.toLowerCase().includes(anchor.toLowerCase())) continue;
    let el: Element | null = p.nextElementSibling;
    while (el && el.tagName !== 'UL') el = el.nextElementSibling;
    if (el) {
      ul = el;
      break;
    }
  }
  if (!ul) return out;

  const lis = Array.from(ul.querySelectorAll('li'));
  for (const li of lis) {
    const strong = li.querySelector('strong');
    if (!strong) continue;
    const name = (strong.textContent || '').trim().replace(/:$/, '').trim();
    if (!name) continue;
    const clone = li.cloneNode(true) as Element;
    const strongClone = clone.querySelector('strong');
    if (strongClone) strongClone.remove();
    const desc = (clone.textContent || '')
      .replace(/\u00a0/g, ' ')
      .replace(/^:\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (desc) out.set(normalizeZameraniName(name), desc);
  }
  return out;
}

// Parse "Zaměření musí absolvovat během studia alespoň dvě" → 2.
// Supports cs word numbers (jedno/dvě/tři/čtyři/pět) and plain digits.
function extractZameraniMinimum(doc: Document, lang: Lang): number | undefined {
  const body = (doc.body?.textContent || doc.documentElement?.textContent || '').replace(
    /\s+/g,
    ' '
  );
  const anchor =
    lang === 'cz'
      ? /musí absolvovat[^.]*?alespoň\s+([\wěščřžýáíéůúňťďó]+)/i
      : /must complete[^.]*?at least\s+(\w+)/i;
  const m = body.match(anchor);
  if (!m) return undefined;
  const token = m[1].toLowerCase();
  const digit = parseInt(token, 10);
  if (!Number.isNaN(digit)) return digit;
  const words: Record<string, number> = {
    jedno: 1,
    jednu: 1,
    jednoho: 1,
    one: 1,
    dvě: 2,
    dve: 2,
    dva: 2,
    two: 2,
    tři: 3,
    tri: 3,
    three: 3,
    čtyři: 4,
    ctyri: 4,
    four: 4,
    pět: 5,
    pet: 5,
    five: 5,
  };
  const stripped = token.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return words[token] ?? words[stripped];
}

function findZameraniUl(doc: Document, lang: Lang): Element | null {
  const anchor = lang === 'cz' ? 'Studijní plán zaměření' : 'study plan of specialization';
  for (const p of Array.from(doc.querySelectorAll('p'))) {
    if (!(p.textContent || '').toLowerCase().includes(anchor.toLowerCase())) continue;
    let el: Element | null = p.nextElementSibling;
    while (el && el.tagName !== 'UL') el = el.nextElementSibling;
    if (!el) {
      const uls = p.parentElement?.querySelectorAll('ul');
      if (uls?.length) el = uls[0];
    }
    if (el) return el;
  }
  return null;
}

/** Returns subject lists from <li> items that lack a <strong> name tag
 *  (e.g. "předměty EXA-UP01-04."). Used to recover subjects for zaměření
 *  whose name could not be parsed from the <ul>. */
function extractUnnamedZameraniSubjects(doc: Document, lang: Lang): ZamerangSubjectRef[][] {
  const ul = findZameraniUl(doc, lang);
  if (!ul) return [];
  const result: ZamerangSubjectRef[][] = [];
  for (const li of Array.from(ul.querySelectorAll('li'))) {
    if (li.querySelector('strong')) continue;
    // eslint-disable-next-line no-irregular-whitespace
    const text = (li.textContent || '').replace(/ /g, ' ').trim();
    const subjects = parseZameraniSubjectList(text);
    if (subjects.length > 0) result.push(subjects);
  }
  return result;
}

// Zaměření paragraph lives above the plan table: a <p> starting with
// "Studijní plán zaměření" / "The study plan of specialization", followed by a <ul>
// whose <li> items look like:
//   <strong>Vývoj webových aplikací</strong>: EBC-WGD Webová grafika..., EBC-WAF ...;
// Degrade gracefully: if anchor not found, return [].
function extractZameranis(doc: Document, lang: Lang): Zamerani[] {
  const ul = findZameraniUl(doc, lang);
  if (!ul) return [];

  const result: Zamerani[] = [];
  const lis = Array.from(ul.querySelectorAll('li'));
  for (const li of lis) {
    const strong = li.querySelector('strong');
    if (!strong) continue;
    const name = (strong.textContent || '').trim().replace(/:$/, '').trim();
    if (!name) continue;

    // Remove the <strong> from a clone and read the remaining text.
    const clone = li.cloneNode(true) as Element;
    const strongClone = clone.querySelector('strong');
    if (strongClone) strongClone.remove();
    const rest = (clone.textContent || '')
      .replace(/\u00a0/g, ' ')
      .trim()
      .replace(/^:\s*/, '');

    const subjects = parseZameraniSubjectList(rest);
    if (subjects.length === 0) continue;
    result.push({ name, subjects });
  }
  return result;
}

function parseZameraniSubjectList(text: string): ZamerangSubjectRef[] {
  // Two shapes:
  //  A) "EBC-WGD Webová grafika a design, EBC-WAF Webové aplikace: frontend, ... a EBC-EA Enterprise aplikace;"
  //  B) zahraniční mobilita: "předměty EXA-UP01–04." (range, no per-subject name)
  const out: ZamerangSubjectRef[] = [];

  // BRITTLE fallback: EXA-UP01–04 range expansion. If IS Mendelu rewords this
  // line we lose this one zaměření only — acceptable.
  const rangeMatch = text.match(/([A-Z]{2,4}-[A-Z]+)(\d+)\s*[–-]\s*(\d+)/);
  if (rangeMatch && !/[A-Z]{2,4}-[A-Z0-9]+\s+[A-ZŽŠČŘĎŤŇa-záéěíóúůýčďňřšťž]/.test(text)) {
    const prefix = rangeMatch[1];
    const start = parseInt(rangeMatch[2], 10);
    const end = parseInt(rangeMatch[3], 10);
    const pad = rangeMatch[2].length;
    for (let i = start; i <= end; i++) {
      const code = `${prefix}${String(i).padStart(pad, '0')}`;
      out.push({ code, name: code });
    }
    return out;
  }

  // Split into tokens by locating course-code starts.
  const codeRegex = /([A-Z]{2,4}-[A-Z0-9]+)/g;
  const matches: { code: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = codeRegex.exec(text)) !== null) {
    matches.push({ code: m[1], index: m.index });
  }
  for (let i = 0; i < matches.length; i++) {
    const { code, index } = matches[i];
    const nameStart = index + code.length;
    const nameEnd = i + 1 < matches.length ? matches[i + 1].index : text.length;
    let name = text.slice(nameStart, nameEnd).trim();
    // Trim trailing "," / ";" / "a" conjunction / "." / whitespace.
    name = name
      .replace(/[,;.]+\s*(?:a\s+)?$/, '')
      .replace(/\s+a\s*$/, '')
      .trim();
    if (!name) name = code;
    out.push({ code, name });
  }
  return out;
}
