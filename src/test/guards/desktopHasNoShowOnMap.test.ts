import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * "Ukázat na mapě" was removed from the DESKTOP tree only.
 *
 * On desktop it was a button labelled with a whole sentence, sitting inside a
 * calendar block that is minutes tall, next to a room name that already said
 * where the lesson was. The room stays reachable on the map — the control is
 * the room itself now, as it already was for Q rooms.
 *
 * Both halves are pinned here. The phone sheet keeps its button (a sheet has
 * room for it, and touch has no hover affordance to replace it), and so does
 * the admin console's event composer, where it previews an unpublished event's
 * pin and is the whole point of the screen. A later "let's just reuse this
 * component" is exactly how the desktop one comes back.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('showOnMap placement', () => {
  it.each([
    'components/CalendarEventCard.tsx',
    'components/MapHoverCard.tsx',
    'components/SubjectFileDrawer/Header/CourseMeta.tsx',
  ])('%s does not offer a "show on map" button', (file) => {
    expect(read(file)).not.toContain('showOnMap');
  });

  it.each([
    'components/mobile/sheets/EventDetailSheet.tsx',
    'components/CampusMap/EventComposer.tsx',
  ])('%s still does', (file) => {
    expect(read(file)).toContain('showOnMap');
  });

  it('keeps the translation key, since the surfaces that stayed still use it', () => {
    const cs = JSON.parse(read('i18n/locales/cs.json')) as Record<string, Record<string, string>>;
    expect(cs['map']?.['showOnMap']).toBe('Ukázat na mapě');
  });
});
