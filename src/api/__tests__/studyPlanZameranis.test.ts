import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { borrowZameranisFromCz, parseStudyPlanDOM } from '../studyPlan';
import type { StudyPlan } from '../../types/studyPlan';

const fixture = (lang: 'cz' | 'en') =>
  new DOMParser().parseFromString(
    readFileSync(
      resolve(process.cwd(), `src/api/__tests__/fixtures/study-plan-zameranis.${lang}.html`),
      'utf8'
    ),
    'text/html'
  );

/**
 * Captured from a real IS study plan on 2026-09-05, one page per language.
 *
 * The two fixtures are byte-identical apart from the comment naming the
 * language they came from — that is the whole finding: IS serves the Czech
 * zaměření section on the English page too.
 */
describe('zaměření on the English study plan', () => {
  it('is not translated by IS — the English page carries the Czech paragraph', () => {
    const en = readFileSync(
      resolve(process.cwd(), 'src/api/__tests__/fixtures/study-plan-zameranis.en.html'),
      'utf8'
    );
    expect(en).toContain('Studijní plán zaměření');
    expect(en).not.toContain('study plan of specialization');
  });

  it('parses in Czech', () => {
    const plan = parseStudyPlanDOM(fixture('cz'), 'cz');
    expect(plan.zameranis?.map((z) => z.name)).toEqual([
      'Vývoj webových aplikací',
      'Vývoj mobilních aplikací',
      'Vývoj vestavěných systémů',
      'Řízení podniku',
    ]);
    expect(plan.zameranis?.every((z) => z.subjects.length === 4)).toBe(true);
  });

  it('parses to nothing in English, because the anchor it looks for is never emitted', () => {
    // Not a fixture quirk: this is what a student in English mode actually got,
    // five rows that expanded onto an empty panel.
    expect(parseStudyPlanDOM(fixture('en'), 'en').zameranis ?? []).toEqual([]);
  });
});

const plan = (zameranis: StudyPlan['zameranis']): StudyPlan =>
  ({ title: '', isFulfilled: false, blocks: [], zameranis }) as unknown as StudyPlan;
const withSubjects = [
  { name: 'Vývoj webových aplikací', subjects: [{ code: 'EBC-WGD', name: 'Webová grafika' }] },
] as unknown as StudyPlan['zameranis'];
const empty = [
  { name: 'Scope: Web Application Development', subjects: [] },
] as unknown as StudyPlan['zameranis'];

describe('borrowZameranisFromCz', () => {
  it('gives English the Czech list when English parsed nothing usable', () => {
    expect(borrowZameranisFromCz(plan(empty), plan(withSubjects)).zameranis).toEqual(withSubjects);
  });

  it('leaves English alone once it has content of its own', () => {
    const enOwn = [
      {
        name: 'Web Application Development',
        subjects: [{ code: 'EBC-WGD', name: 'Web graphics' }],
      },
    ] as unknown as StudyPlan['zameranis'];
    expect(borrowZameranisFromCz(plan(enOwn), plan(withSubjects)).zameranis).toEqual(enOwn);
  });

  it('borrows nothing when Czech has nothing either', () => {
    expect(borrowZameranisFromCz(plan(empty), plan(empty)).zameranis).toEqual(empty);
  });

  it('counts a description as content, not just subjects', () => {
    const descOnly = [
      { name: 'X', subjects: [], description: 'text' },
    ] as unknown as StudyPlan['zameranis'];
    expect(borrowZameranisFromCz(plan(descOnly), plan(withSubjects)).zameranis).toEqual(descOnly);
  });
});
