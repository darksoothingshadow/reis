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

**Subject space (split view) smoke PASSED on the simulator 2026-09-06:** the space opens with the
subject title, a system Close and Apple's sidebar toggle; the list follows the drawer's grouped
order with a pencil mark on inked files; tapping an uncached file shows the reader empty, the
app fetches and caches it (`needsFile` → `deliverFile`), and the page and title swap; the toggle
collapses the sidebar and moves to the reader's bar; Close dismisses and both shown files get
`lastOpenedAt` at the close time. **Observed once, not reproduced:** in the first run (before
`clearsSelectionOnViewWillAppear = false` and the selection-preserving `setHasInk`), two lecture
files were fetched and a third displayed a few seconds after a single row tap, without further
taps. Step 15 below covers it on the device.

**Three follow-ups verified on the simulator 2026-09-07 (build of commit 0fd693c0):**

- *Files must not disappear.* The reader's sidebar now lists this subject's cached files that
  IS no longer offers, last in the list. Verified by seeding one index entry for EBC-AP with a
  link the folder does not contain: it appeared at the bottom of the sidebar and opened straight
  from the device (`select … cached=true`, no fetch). The other half — the LRU sweep never
  evicting a PDF that has ink — is **unit-tested only**; a 300 MB cache is not producible here.
  The boundary worth knowing: a kept file is reachable through the reader, which is reached from
  a subject's file list, so if IS lists nothing at all for a subject there is no way in.
- *Add a blank page.* "+" in the reader's bar inserted white paper after the page on screen and
  scrolled to it; a stroke drawn there survived Close and reopen (`blank page added at 1`, and
  the page came back with its ink). The file's existing ink, written by a version 1 archive,
  loaded unchanged.
- *Export with the notes.* The reader's share button writes a copy with the ink baked into the
  pages and hands it to the share sheet. Verified by pulling the produced file out of the
  simulator container: all four pages there, the strokes exactly where they were drawn, the page
  text still extractable (`PDFPage.string`), 585 KB. Placement is what the unit test guards —
  it asserts ink at the point the stroke was drawn and white in a corner that was not.
- *Getting around a deck (2026-09-07).* The bar shows "5/64" and opens a thumbnail grid; picking
  a page goes there. A sheet, not an edge strip: the palm-jump complaint is what every app with a
  scrubber collects. Search finds "cviceni" in "CVIČENÍ" (diacritic- and case-insensitive) and
  lands on the page with the match selected. An added page can be taken back by long-pressing it
  in the grid — verified on a page a mis-tap had added: 65 pages back to 64, archive back to no
  added pages, the existing ink untouched. **A synthetic tap cannot select a UIKit context-menu
  item**, so that last step needed a human finger; anything driving this from a script will hit
  the same wall.
- *A row tap opens the reader.* Already true for PDFs (re-checked); now also for rows IS gives
  no type. A row IS types as something else (PPT) still goes to the share sheet, and the
  `%PDF-` check that makes untyped rows safe is unit-tested — this subject has no untyped row.

Fill in the device, iPadOS version and build, then tick each step with what was observed. The simulator run (plan Task 9 Step 2) covers finger
drawing only; everything about the Pencil needs the physical iPad (8th gen,
`AAB487DD-1610-525F-A8E5-3E29666A8B90`).

Build and install (see memory `ipad-device-build-install`):

    npm run cap:sync
    xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
      -destination 'id=<xcodebuild-udid>' -allowProvisioningUpdates DEVELOPMENT_TEAM=RG38V3SV8X build
    xcrun devicectl device install app --device <core-device-id> <path to App.app>
    xcrun devicectl device process launch --device <core-device-id> --console cz.reis.app 2>&1 | tee pdfink-device.log
    grep PdfInk pdfink-device.log    # in a second terminal, or afterwards — launch errors stay visible in the first

Device: ______ iPadOS: ______ Build: ______ Pencil: ______

1. [ ] Open a subject PDF, draw on pages 1 and 3 with the Pencil, tap Close, reopen → strokes on both pages.
2. [ ] With a Pencil paired and "Draw with Finger" OFF in the tool picker: a finger scrolls, a resting palm draws nothing.
3. [ ] Turn "Draw with Finger" ON in the tool picker: a finger draws. Turn it OFF: a finger scrolls again. (This is the system-wide Notes setting.)
4. [ ] Pinch to the maximum zoom PDFView allows; inspect stroke edges. Record soft/crisp either way (Apple forum 792941).
5. [ ] Rotate the iPad with a page inked → strokes stay on their content.
6. [ ] Draw, wait 2 s, kill the app from the switcher, reopen → the stroke is there.
7. [ ] Draw, background the app mid-session, return → nothing lost.
8. [ ] Wi-Fi off, reopen the same file → opens instantly from the cache.
9. [ ] Re-upload: the app container is not editable on the device, so use a file whose IS document date changed between two opens (a teacher re-uploaded, or a document you control). Reopen online → the console shows a fetch and the copy is replaced. If no such file exists during the run, record "not exercised" — `refetches once when the IS document date changed` covers it in vitest.
10. [ ] Corrupt PDF: not producible on the device without container access. Record "unit-tested only" — the native guard (`InkDocument.open` returns nil for junk and for a missing file, a real page opens) is covered by `InkDocumentTests`, and the JS fallback by `refetches for the web viewer when a FRESH copy turns out unreadable`. Neither drives `PdfInkPlugin.open` through the bridge; that path is verified only by the simulator smoke.
11. [ ] iPhone (simulator is fine) → the web viewer opens as before.
12. [ ] A 100+ page deck with ink on a dozen pages scrolls smoothly.
13. [ ] Light and dark system appearance both readable.
14. [ ] Erase every stroke, Close → console prints `PdfInk: ink deleted`.
15. [ ] Sidebar: tap three different files in turn, including one not yet cached (spinner, then
        the page). The reader must only ever show the file you tapped; the console prints
        `PdfInk: sidebar tapped row …` once per tap and `PdfInk: select …` for each. Any
        `select` without a matching tap is the unreproduced finding above — report it.
16. [ ] Hide the sidebar with Apple's toggle, draw, show it again → the selection highlight is
        still on the current file and the pencil mark appears on it.
17. [ ] Close with the X → back in the drawer; reopen the same file → strokes present, sidebar
        selection on it.
18. [ ] Add a page with "+" mid-deck, draw on it with the Pencil, add a second one, switch files
        and come back → both pages are where you put them and the ink is on them, not on their
        neighbours.
19. [ ] With ink on a file, put the iPad in flight mode and open the subject → the annotated file
        is in the sidebar and opens; nothing is refetched.
20. [ ] Pages: the bar reads "n/total" and opens the thumbnail grid; picking a page goes there,
        inked pages carry the pencil mark, and resting a palm anywhere on the page never changes
        the page (the reason this is a sheet and not an edge strip).
21. [ ] Search: a Czech word typed WITHOUT accents finds the accented one; picking a result lands
        on its page with the match selected.
22. [ ] Long-press an added page in the grid → Remove; with ink on it, the confirmation appears
        first. A page of the teacher's file offers no menu.
23. [ ] Share (the bar's export button) on a file with ink → the sheet names the file; save it to
        Files and open it in Apple's Preview: the ink is in the pages, added pages included, and
        the text is still selectable. Print the same file and check the ink is on the paper.
24. [ ] Two files side by side: the split button (left of the page counter) opens an empty half
        that says "Pick a file from the list" and reveals the sidebar; pick a file and both halves
        show their own file, title, page counter and ink.
25. [ ] Tap the file the OTHER half is showing → the highlight moves to it and nothing loads twice;
        the half keeps the file it had. Then touch each half in turn → the title of the half you
        touched goes black and the other greys.
26. [ ] Draw in both halves, close the right one with its X, reopen it on the same file → the
        strokes are there. The left half re-fits its page to the full width when the split closes.
27. [ ] Put the app in Split View or Slide Over against another app until reIS is under 700pt wide
        → the split folds back to one half (strokes saved first) and the split button disappears;
        widen it again and the button returns. This is the one step the iPad Air cannot show at
        full screen — it is 820pt across in portrait — so it needs Stage Manager or Slide Over.

## Known edge, not fixed

An added page and the ink on it can part company if the teacher re-uploads a SHORTER PDF.
`InkPages.apply` clamps an insert past the new end back to the end; the ink keeps the page index
it was drawn at, so the blank page comes back empty and those strokes are held but not shown.
Nothing is destroyed, and it needs both a shortened re-upload and an added page beyond the new
end. Fixing it means shifting the ink keys by the same clamp delta — a larger change than this
branch should carry.

## Still open: the drawer itself is tied to reaching IS

Checklist item 1 was "files must not disappear when IS cannot be reached". The reader's sidebar
now keeps them (`keptFiles`, step 19), but that only helps a student who is already inside the
reader. The subject's own file drawer is still listed live: with no IS session every subject reads
"Žádné soubory nejsou k dispozici", and there is then no row to tap and no door into the reader.
Seen on the simulator on 2026-09-07 once its session expired. Closing this properly means the
drawer falling back to what is cached, the same stale-if-error rule `serveFile` already follows.

## Report back

Record any finding not in the design here, with the step number.
