import { describe, it, expect } from 'vitest';
import { makeLesson } from '../../../test/fixtures/lesson';
import { roomCodeFor, subjectSheetFor } from '../lessonActions';

describe('lessonActions', () => {
  it('builds the subject drawer sheet from the lesson itself — no lookup, no day matching', () => {
    const lesson = makeLesson({ courseCode: 'EBC-AP', courseName: 'Architektura počítačů' });
    expect(subjectSheetFor(lesson)).toEqual({
      kind: 'subjectDrawer',
      courseCode: 'EBC-AP',
      courseName: 'Architektura počítačů',
    });
  });

  it('strips the trailing "(Campus)" from the room the way openRoute always has', () => {
    expect(roomCodeFor(makeLesson({ room: 'Q01 (Brno)' }))).toBe('Q01');
    expect(roomCodeFor(makeLesson({ room: 'Q01' }))).toBe('Q01');
    expect(roomCodeFor(makeLesson({ room: '  Q01  ' }))).toBe('Q01');
  });
});
