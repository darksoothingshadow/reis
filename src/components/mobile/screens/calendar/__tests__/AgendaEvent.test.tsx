import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgendaEvent } from '../AgendaEvent';
import { useAppStore } from '../../../../../store/useAppStore';
import { makeLesson } from '../../../../../test/fixtures/lesson';

describe('AgendaEvent', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
  });

  it('tapping the row opens the subject and does not touch the map', () => {
    const onOpenSubject = vi.fn();
    const onShowOnMap = vi.fn();
    render(
      <AgendaEvent
        lesson={makeLesson({ courseName: 'Management' })}
        onOpenSubject={onOpenSubject}
        onShowOnMap={onShowOnMap}
      />
    );

    fireEvent.click(screen.getByText('Management'));

    expect(onOpenSubject).toHaveBeenCalledTimes(1);
    expect(onShowOnMap).not.toHaveBeenCalled();
  });

  it('tapping the pin shows the map and does not open the subject', () => {
    const onOpenSubject = vi.fn();
    const onShowOnMap = vi.fn();
    render(
      <AgendaEvent lesson={makeLesson()} onOpenSubject={onOpenSubject} onShowOnMap={onShowOnMap} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ukázat na mapě' }));

    expect(onShowOnMap).toHaveBeenCalledTimes(1);
    expect(onOpenSubject).not.toHaveBeenCalled();
  });

  it('is two controls, not a button inside a button', () => {
    render(<AgendaEvent lesson={makeLesson()} onOpenSubject={() => {}} onShowOnMap={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect(b.parentElement?.closest('button')).toBeNull();
  });
});
