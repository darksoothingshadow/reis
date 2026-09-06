# iPad PDF ink — device verification checklist

**Status: simulator smoke PASSED 2026-09-06 (iPad Air 11-inch (M4) simulator, iPadOS 26.6,
Debug build of commit 0eb8ad6e); device steps not yet run.** The simulator covered, with a
finger (no Pencil is paired there, so `.default` lets a finger draw): the reader opening from a
subject row with Apple's tool picker; a stroke rendering with the picker's undo enabling; Done;
reopening the same file from the cache (the PDF's file time did not change, its `lastOpenedAt`
did) with the stroke present; pixel-erasing everything and Done printing `PdfInk: ink deleted`
with the `.ink` file gone. Container inspected: two PDFs plus `index.json` under
`Library/NoCloud/pdf-ink`, the archive under `Library/pdf-ink`.

**Found on the first device run, fixed in 0eb8ad6e:** drawing crashed the app (stack overflow —
the PDF view's `undoManager` override recursed with PencilKit's responder-chain lookup), and the
first laid-out page had no canvas so a finger scrolled instead of drawing (the overlay provider
was assigned after the document). Both are covered by the simulator smoke above.

**Found on the second device run, fixed in the following commit:** the default pen drew white
(PencilKit inverts ink for dark mode; the canvases and picker are now forced light, since PDF
paper is white in any appearance — reproduced with the simulator in dark appearance), and
scrolling to the top fought and stopped 37pt short (PDFView ignores the translucent bar's
automatic content inset; the PDF view is now pinned to the safe area — traced with an offset
log: oscillating −48…−67 before, monotonic −26→0 after).

Fill in the device, iPadOS version and build, then tick each step with what was observed. The simulator run (plan Task 9 Step 2) covers finger
drawing only; everything about the Pencil needs the physical iPad (8th gen,
`AAB487DD-1610-525F-A8E5-3E29666A8B90`).

Build and install (see memory `ipad-device-build-install`):

    npm run cap:sync
    xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
      -destination 'id=<xcodebuild-udid>' -allowProvisioningUpdates DEVELOPMENT_TEAM=RG38V3SV8X build
    xcrun devicectl device install app --device <core-device-id> <path to App.app>
    xcrun devicectl device process launch --device <core-device-id> --console cz.reis.app 2>&1 | grep PdfInk

Device: ______ iPadOS: ______ Build: ______ Pencil: ______

1. [ ] Open a subject PDF, draw on pages 1 and 3 with the Pencil, tap Done, reopen → strokes on both pages.
2. [ ] With a Pencil paired and "Draw with Finger" OFF in the tool picker: a finger scrolls, a resting palm draws nothing.
3. [ ] Turn "Draw with Finger" ON in the tool picker: a finger draws. Turn it OFF: a finger scrolls again. (This is the system-wide Notes setting.)
4. [ ] Pinch to the maximum zoom PDFView allows; inspect stroke edges. Record soft/crisp either way (Apple forum 792941).
5. [ ] Rotate the iPad with a page inked → strokes stay on their content.
6. [ ] Draw, wait 2 s, kill the app from the switcher, reopen → the stroke is there.
7. [ ] Draw, background the app mid-session, return → nothing lost.
8. [ ] Wi-Fi off, reopen the same file → opens instantly from the cache.
9. [ ] Re-upload: the app container is not editable on the device, so use a file whose IS document date changed between two opens (a teacher re-uploaded, or a document you control). Reopen online → the console shows a fetch and the copy is replaced. If no such file exists during the run, record "not exercised" — `refetches once when the IS document date changed` covers it in vitest.
10. [ ] Corrupt PDF: not producible on the device without container access. Record "unit-tested only" — `refetches for the web viewer when a FRESH copy turns out unreadable` covers it.
11. [ ] iPhone (simulator is fine) → the web viewer opens as before.
12. [ ] A 100+ page deck with ink on a dozen pages scrolls smoothly.
13. [ ] Light and dark system appearance both readable.
14. [ ] Erase every stroke, Done → console prints `PdfInk: ink deleted`.

## Report back

Record any finding not in the design here, with the step number.
