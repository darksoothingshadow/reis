# iPad reader: an exit in the reader's own bar

**Date:** 2026-09-07 · **Scope:** `native/capacitor-pdf-ink` only · **Branch:** PR #304 follow-up

## The problem

PR #304 withdrew the reader's own Close, so the only way out of a subject's PDF
space is the X on the file sidebar — and the sidebar opens on the page alone. A
student who wants to leave must know to tap Apple's sidebar toggle (or swipe
from the left edge) and then find the X there. Nothing on the reader screen says
"you can leave"; the four buttons it has all act inside the file. Apple's HIG:
*always give people an obvious way to dismiss a modal view*, and the space is
presented `.fullScreen`.

## What was proven on the simulator (2026-09-07)

The repo records, in `PdfInkSpace.swift` and `ReaderBarTests`, that placing an
item of ours on the leading edge "hands out an item with no glyph and no action:
an empty circle where the sidebar used to be". That describes **placing the
toggle by hand**. It is not what `leadingItemGroups` does:

| Claim                                              | Result                                                         |
| -------------------------------------------------- | -------------------------------------------------------------- |
| `navigationItem.leadingItemGroups` renders our item | Yes — the glyph drew                                           |
| The split view's toggle survives beside it         | Yes — kept its glyph, opened the sidebar when tapped           |
| Our item's action fires                            | Yes — every tap logged (`PdfInk: EXPERIMENT exit tapped`)      |
| Where ours lands                                   | **Right** of the toggle: `[toggle] [ours]`. UIKit injects first |

When the sidebar is shown, UIKit moves the toggle into the sidebar's own header
and ours becomes the leftmost item in the reader's bar. The arrangement shifts
with sidebar state; both states are acceptable.

Dominik's own device test found the same: the hand-placed variant *worked*, and
what he disliked was its position. Placing ours to the LEFT of the toggle
requires the hand-placed toggle. Decision: **accept right of the toggle**. It is
proven, needs no new API, and once the sidebar is open the exit is leftmost
anyway.

## Design

### `PdfInkViewController`

- A new `exitItem`: `UIBarButtonItem(image: UIImage(systemName: "xmark"), …)`,
  `accessibilityLabel = strings.close`, action `exitTapped` → `onCloseSpace?()`.
- Installed in `viewDidLoad` as
  `navigationItem.leadingItemGroups = [UIBarButtonItemGroup(barButtonItems: [exitItem], representativeItem: nil)]`.
  Never `leftBarButtonItems`, never the toggle by hand.
- `onCloseSpace: (() -> Void)?` returns — the same hook PR #304 removed.
- **Glyph is `xmark`, not `chevron.backward`.** A chevron promises "back to
  where I came from"; this dismisses a full-screen modal, and the sidebar's
  control for the same act is already an X. Same meaning, same shape.
- **Colour cannot help.** On iPadOS 26 bar buttons are monochrome glass and
  ignore `tintColor` entirely (verified 2026-09-07). The exit is distinguished
  by glyph and position only.
- `setBarItems(enabled:)` does not touch `exitItem`: the exit must work while a
  file is still loading or has failed to open.

### `PdfInkSpace`

- `split.displayModeButtonVisibility` stays `.automatic`.
- `reader.onCloseSpace = { [weak self] in self?.closeTapped() }` returns, so the
  reader's exit takes exactly the sidebar's path: `persistNow()` first, the
  save-failed alert if that refuses, `finish()` otherwise. One exit path, two
  buttons.
- The class comment's claim about a dead empty circle is rewritten to say what
  is actually true: a *hand-placed* toggle is the thing that breaks;
  `leadingItemGroups` beside the automatic toggle does not.

### Strings

No new string. `strings.close` already exists and is used by the sidebar's X
and the save-failed alert.

## Tests (`ReaderScaleTests.swift`, Swift package)

- `testTheLeadingEdgeIsLeftToTheSplitView` is **replaced**. It asserts the
  opposite of the design. New: `testTheExitSitsInTheLeadingGroupAndNothingElseDoes`
  — `leadingItemGroups` has exactly one group, containing exactly one item whose
  `accessibilityLabel == strings.close`; `leftBarButtonItems` stays nil.
- `testTheBarCarriesTheFourFileToolsAndNothingElse` is unchanged: the exit is
  a leading item, the trailing group still has four.
- `testTheReadersOwnCloseIsNotBack` is **deleted**; it now pins the wrong
  thing.
- `SpaceExitTests` gains `testTheReadersExitClosesTheSpace`: fire the exit's
  target/action, assert `onClose` fires. Mirror of the existing sidebar case,
  including the sensitivity check (comment out the wiring, watch it fail) before
  committing.
- Toggle survival cannot be unit-tested: UIKit injects it at render time and it
  never appears in `navigationItem`. It is covered by the simulator run above
  and by device checklist step 24, which is rewritten to say the bar carries
  the exit plus four tools, and the toggle beside the exit still opens the
  sidebar.

## Docs

- `2026-09-06-ipad-pdf-ink-design.md` addendum: the "Leaving is the sidebar's
  Close … one tap more" cost is retracted; the reader has an exit again, and
  the reason it was possible this time is recorded (groups, not hand placement).
- Verification checklist steps 17 and 24 updated as above.

## Out of scope

- Ours to the left of the toggle (hand-placed toggle). Rejected above.
- Sidebar always visible (`.oneBesideSecondary`). Considered; the exit makes it
  unnecessary.
- Anything in the web tree.
