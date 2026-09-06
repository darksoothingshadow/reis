import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StatsBars } from '../StatsBars';

// verify-ui measured the suppressed ("under 5") bar by hand — the automated
// probe skips SVG fills entirely (see uiFindings.ts's own text-node-only
// contrast check) — and found the DaisyUI-green-at-30%-opacity treatment
// nearly invisible: composited it is 1.77:1 in the dark theme and 1.27:1 in
// light, both well under the 3:1 WCAG non-text-contrast floor for a graphical
// indicator. A neutral base-content fill at 50% alpha measures 4.48:1 (dark)
// and 3.39:1 (light) instead — still visually muted next to a full-strength
// bar, but actually visible in both themes.
describe('StatsBars — suppressed ("under 5") bar contrast', () => {
  it('paints a suppressed group with a base-content fill, not the low-contrast primary-at-0.3', () => {
    const { container } = render(
      <StatsBars groups={[{ key: 'unknown', installs: -1 }]} labelFor={(k) => k} under5="under 5" />
    );
    const rect = container.querySelector('rect')!;
    expect(rect.getAttribute('class') ?? '').toContain('fill-base-content/50');
    expect(rect.getAttribute('fill')).not.toBe('currentColor');
  });

  it('still paints a normal group at full strength in the primary colour', () => {
    const { container } = render(
      <StatsBars groups={[{ key: 'PEF', installs: 50 }]} labelFor={(k) => k} under5="under 5" />
    );
    const rect = container.querySelector('rect')!;
    expect(rect.getAttribute('class') ?? '').toContain('fill-primary');
  });
});
