# REIS Component Map

This document provides an overview of the main UI building blocks in the REIS extension.

## 📦 Core Layout

### `App.tsx`
- **Role**: Entry point and layout orchestrator.
- **State**: Manages current view (Calendar/Exams) and selected lesson.
- **Sidebar Integration**: Handles navigation between views.

### `Sidebar.tsx`
- **Location**: Left side (desktop), Bottom (mobile).
- **Function**: View switching and quick access to external IS links.

## 📅 Schedule & Calendar

### `WeeklyCalendar.tsx`
- **Role**: Main schedule visualization.
- **Features**: Horizontal week navigation, responsive breakpoints, subject card rendering.

### `CalendarEventCard.tsx`
- **Role**: Individual lesson representation.
- **Design**: Color-coded by subject type (lecture, seminar, exam).

## 📄 File Management

### `SubjectFileDrawer/index.tsx`
- **Role**: Contextual file access for a specific subject.
- **Features**: Drag-to-select multiple files, tabbed navigation (Files/Success Rates).

### `useDragSelection.ts`
- **Role**: Reusable hook for drag-to-select logic.
- **Thresholds**: 5px drag start, auto-scroll at container edges.

## 🎓 Exam Panel

### `ExamPanel/index.tsx`
- **Role**: Full-screen exam registration interface.
- **Sub-components**: `ExamFilterBar`, `ExamSectionCard`, `ExamTimeline`.

### `ExamTimeline.tsx`
- **Role**: Visual gantt-style chart showing exam distribution over the semester.

## 🔄 Utilities & Hooks

- `useSearch`: Logic for the global search bar.
- `useOutlookSync`: State management for calendar export.
- `calendarUtils`: Modular helpers for time/week calculations.
