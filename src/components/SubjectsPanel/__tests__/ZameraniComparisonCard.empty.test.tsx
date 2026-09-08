import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ZameraniComparisonCard } from '../ZameraniComparisonCard';
import type { ZameraniInsight } from '../insights';

/**
 * A specialization with nothing behind it must not offer a chevron.
 *
 * `studyPlan.en` really does arrive this way: every specialization comes back
 * with zero subjects and no description, because the parser's English anchor
 * misses (src/api/studyPlan.ts). Dominik hit it live — the row toggled, the
 * chevron flipped, and nothing appeared. Whatever the parser does later, a
 * control that opens onto emptiness is its own bug.
 */
const insight = (over: Partial<ZameraniInsight> = {}): ZameraniInsight => ({
  name: 'Scope: Development of Integrated Systems',
  subjects: [],
  weightedFailRate: null,
  worstSubject: null,
  lowSampleCount: 0,
  totalCredits: 0,
  ...over,
});

// The card renders nothing below two specializations, and starts collapsed —
// so every case here needs a filler row and one click on the header.
const filler = (): ZameraniInsight => insight({ name: 'Scope: Business Management' });

const renderCard = (insights: ZameraniInsight[], onTogglePick = vi.fn()) => {
  const out = render(
    <ZameraniComparisonCard
      insights={[...insights, filler()]}
      picks={new Set()}
      onTogglePick={onTogglePick}
      onOpenSubject={vi.fn()}
      onSearchSubject={vi.fn()}
    />
  );
  fireEvent.click(screen.getByText('Srovnání zaměření'));
  return out;
};

describe('ZameraniComparisonCard with nothing to expand', () => {
  // The card header carries a chevron of its own, so every assertion here is
  // scoped to the specialization ROW rather than the whole container.
  const rowFor = (label: string) => screen.getByText(label).closest('button')!;

  it('offers no expand control when there are no subjects and no description', () => {
    renderCard([insight()]);
    const row = rowFor('Development of Integrated Systems');
    expect(row.querySelector('.lucide-chevron-down')).toBeNull();
  });

  it('still lets the specialization be picked', () => {
    const onTogglePick = vi.fn();
    renderCard([insight()], onTogglePick);
    fireEvent.click(screen.getAllByTitle(/zaměření/i)[0]!);
    expect(onTogglePick).toHaveBeenCalled();
  });

  it('keeps the chevron when there is a description but no subjects', () => {
    renderCard([insight({ description: 'Something to read.' })]);
    expect(
      rowFor('Development of Integrated Systems').querySelector('.lucide-chevron-down')
    ).not.toBeNull();
  });

  it('keeps the chevron when there are subjects', () => {
    // Czech "Zahraniční mobilita" is this case — subjects, no description.
    renderCard([
      insight({
        subjects: [{ code: 'EBC-WGD', id: '1', name: 'Webová grafika', credits: 5, stat: null }],
        totalCredits: 5,
      }),
    ]);
    expect(
      rowFor('Development of Integrated Systems').querySelector('.lucide-chevron-down')
    ).not.toBeNull();
  });
});
