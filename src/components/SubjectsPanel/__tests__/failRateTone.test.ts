import { describe, expect, it } from 'vitest';
import { failRateTone, failRateToneHover } from '../failRateTone';

describe('failRateTone', () => {
  it('bands at 20 and 25 percent', () => {
    expect(failRateTone(19.9)).toContain('bg-base-content/5');
    expect(failRateTone(20)).toContain('bg-warning');
    expect(failRateTone(24.9)).toContain('bg-warning');
    expect(failRateTone(25)).toContain('bg-error');
  });

  it('sets the digits in a readable TONE of the band colour, never the raw hue', () => {
    // Two failure modes, one test. Raw `text-error` on `bg-error/12` measures
    // 3.22:1 and `text-warning-content` (white) measured 1.15:1 — that is what
    // shipped. Flattening everything to ink passes contrast but throws the
    // traffic-light signal away, which is the pill's entire job. The tone
    // tokens in index.css are the third option: the hue, dark enough to read.
    expect(failRateTone(30)).toContain('text-[var(--tone-error)]');
    expect(failRateTone(22)).toContain('text-[var(--tone-warning)]');
    for (const rate of [0, 19, 20, 24, 25, 80]) {
      const tone = failRateTone(rate);
      expect(tone).not.toContain('text-error');
      expect(tone).not.toContain('text-warning-content');
    }
  });

  it('keeps the tint a whisper, so the pill stays a pill and not a slab', () => {
    // /35 and /40 passed every contrast check and looked like blocks of paint.
    expect(failRateTone(30)).toContain('bg-error/12');
    expect(failRateTone(22)).toContain('bg-warning/15');
  });

  it('pairs each band with a hover of the same hue', () => {
    expect(failRateToneHover(30)).toContain('error');
    expect(failRateToneHover(22)).toContain('warning');
    expect(failRateToneHover(5)).toContain('base-content');
  });
});
