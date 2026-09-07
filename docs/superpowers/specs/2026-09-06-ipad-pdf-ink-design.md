# iPad PDF ink — design

**Status: approved for planning, 2026-09-06.**

## What this is

On an iPad, a subject PDF opened from the subject drawer opens in a native reader where
the student writes on the pages with Apple Pencil, the way Notes or GoodNotes work. The
ink stays on the device and is there again the next time the same file is opened. The
PDF itself is kept on the device too, so a file a student has opened once opens
instantly, without IS, and offline.

Everything the student touches is Apple's: `PDFView` shows the pages, `PKCanvasView` is
the drawing surface and `PKToolPicker` is the palette (pen, marker, eraser, lasso, ruler,
undo, redo). reIS writes no stroke rendering, no tool UI and no gesture code. The custom
code is glue: present a view, put one canvas on each page, read and write drawing data,
and decide which bytes to open.

### Why not the alternatives

Research on 2026-09-06 (sources at the end) ranked the options for a one-developer,
open-source, iPad-only feature:

- **pdf.js's own annotation editor** — react-pdf does not expose it, pdf.js maintainers
  call it viewer-internal, strokes have no pressure, and an open pdf.js issue (#20498)
  reports inking stopping after pinch-zoom on iOS with uncommitted strokes lost on blur.
- **Apple Markup via `QLPreviewController`** — the smallest build (about 150 lines), but
  a modal Apple sheet instead of a reIS screen, and it persists an edited PDF rather than
  strokes; rejected in favour of strokes over a fresh or cached original.
- **A web canvas overlay on the current pdf.js viewer** — WebKit permits one input type
  at a time and treats the Pencil as touch for scrolling, so "Pencil draws, finger
  scrolls" is fragile in a WKWebView; feel would be ours to build and mid-tier at best.
- **Nutrient / Apryse** — no Capacitor plugin (their Ionic and Cordova wrappers are
  deprecated), no free tier, quote-based annual pricing.

## Scope

In scope:

- iPad running iPadOS 16 or newer (the `PDFPageOverlayViewProvider` API is iOS 16).
  The app's deployment target stays 15.0; the plugin reports itself unavailable below 16.
- Subject files (lecture materials) opened from `SubjectDrawerSheet`.
- Freehand ink: pen, highlighter, eraser, lasso, undo and redo, all from `PKToolPicker`.
- Pencil draws, finger scrolls, with Apple's own "Draw with Finger" toggle: the canvases
  use `drawingPolicy = .default`, which follows the tool picker's finger-drawing switch
  when a Pencil is paired and lets a finger draw when none is. No reIS toggle.
- On-device persistence of the ink and of the PDF bytes.

Out of scope for v1, recorded so they are not rediscovered as gaps:

- Text boxes, shapes, sticky notes, text-snapping highlights.
- Exporting a flattened annotated PDF to Files. Feasible later with
  `PDFDocument.write(to:options:)` and `burnInAnnotationsOption`, after converting each
  `PKDrawing` into a stamp annotation.
- An ink badge in the file list.
- Sync between devices.
- The study documents (potvrzení, přehled), which stay one-tap sealed downloads.
- iPhone, Android, the desktop extension and the web preview. They keep the pdf.js viewer
  unchanged. The PDF cache module is platform-neutral TypeScript and could serve the
  iPhone viewer later; that is a separate decision.

## Architecture

```
SubjectDrawerSheet (phone tree; the iPad runs it)
  └─ usePdfPreview(courseCode)
       viewPdf(link, name, date)
         ├─ pdfInk.isAvailable()  ── false ─▶ fetch → blob URL → <PdfViewer> (as today)
         └─ true
              └─ pdfCache.resolve(key, date)
                   ├─ fresh copy      ─▶ PdfInk.open({ pdfPath, inkPath, title })
                   ├─ stale / missing ─▶ fetchIsBinary → write → index → PdfInk.open
                   └─ fetch failed, stale copy exists ─▶ PdfInk.open (stale-if-error)
              PdfInk.open rejects `unreadable` ─▶ blob URL from the same bytes → <PdfViewer>
```

Three units, each with one job:

| Unit | Where | Does | Depends on |
|---|---|---|---|
| `PdfInk` plugin | `native/capacitor-pdf-ink` (Swift) | Presents the reader; owns reading and writing the ink file | PDFKit, PencilKit, Capacitor |
| `pdfInk` bridge | `src/mobile/pdfInk.ts` | Availability, key derivation, the open sequence with fallback signalling | `@capacitor/core`, `pdfCache` |
| `pdfCache` | `src/mobile/pdfCache.ts` (+ `pdfCacheIndex.ts` if it grows past 200 lines) | Where PDF bytes live, whether a copy is current, eviction | `@capacitor/filesystem` |

`usePdfPreview` orchestrates; it does not know about paths or files.

## Native plugin: `native/capacitor-pdf-ink`

Same shape as `native/capacitor-eduroam` and `native/capacitor-secure-store`: a Swift
package whose name `cap sync` derives from the npm name. The npm package is
`@reis/capacitor-pdf-ink` (a `file:` dependency in `package.json`), so the Swift package
and product are `ReisCapacitorPdfInk`, target `PdfInkPlugin` under
`ios/Sources/PdfInkPlugin`. `cap sync` scans for `@objc(...)` and generates the
registration; nothing is hand-wired into the Xcode project. Android gets no half of this
plugin; `registerPlugin('PdfInk')` on Android returns an object whose methods reject with
Capacitor's "not implemented", which the bridge treats as unavailable.

### API

```ts
interface PdfInkPlugin {
  /** True only on an iPad running iPadOS 16 or newer. */
  isAvailable(): Promise<{ available: boolean }>;
  /**
   * Presents the reader over the app and resolves when the student taps Done.
   * Rejects with code 'unreadable' if PDFKit cannot open the file at pdfPath.
   */
  open(o: {
    pdfPath: string;
    inkPath: string;
    title: string;
    /** Alert copy for a failed save, translated by the app: title, message, keep, discard. */
    strings: PdfInkStrings;
  }): Promise<{ hasInk: boolean }>;
}
```

`isAvailable` answers from `UIDevice.current.userInterfaceIdiom == .pad` and
`#available(iOS 16, *)`. TypeScript never guesses the device from the user agent or the
viewport (a WKWebView can call itself a Macintosh).

Paths are file URIs as returned by `Filesystem.getUri`. The ink file is read and written
by the native side only, so drawing data never crosses the bridge.

### View composition

- A `UINavigationController` wrapping `PdfInkViewController`, presented `.fullScreen`
  from the Capacitor bridge's view controller.
- `PDFView`: `displayMode = .singlePageContinuous`, `autoScales = true`,
  `usePageViewController = false`, `isInMarkupMode = true`. The last two are what let
  touches reach the overlay instead of being consumed by PDFView (Apple forum 716766).
- `PDFPageOverlayViewProvider` (iOS 16): returns one `PKCanvasView` per `PDFPage`,
  transparent (`backgroundColor = .clear`, `isOpaque = false`), sized to the page bounds
  and scaled by PDFKit with the page. PDFKit owns zoom, scroll and layout.
- Drawings, not canvases, are the source of truth: a `[Int: PKDrawing]` dictionary keyed
  by page index. The provider builds a canvas from the drawing when PDFKit asks for a
  page and releases it when PDFKit releases the page. A 200-page deck holds 200 small
  drawings, never 200 live canvases.
- `PKCanvasView.drawingPolicy = .default` on every canvas and
  `toolPicker.showsDrawingPolicyControls = true`: with a Pencil paired a finger scrolls and
  the picker's own "Draw with Finger" switch (a system-wide setting shared with Notes)
  turns finger drawing on; without a Pencil a finger draws. Palm rejection is Apple's.
  reIS ships no toggle of its own.
- One `PKToolPicker` instance observes every live canvas and is shown for the PDF view
  itself (a `PDFView` subclass that can be first responder), so the palette never
  disappears between pages. Undo and redo come from the picker and act on the window's
  undo manager, which every canvas reaches through the normal responder chain. The PDF
  view must NOT override `undoManager`: an override that asked the canvas back recursed
  until the stack overflowed (found on the first device run).
- Navigation bar: title (the file name) and a system Done button, which iOS localises.
  Nothing else.
- Appearance follows the system for the chrome; the paper does not. Every canvas has
  `overrideUserInterfaceStyle = .light` and the picker `colorUserInterfaceStyle = .light`,
  because PencilKit otherwise inverts ink for dark mode and the default pen drew white on a
  white page (found on the first device run). Ink data is unaffected; only rendering.
- The PDF view is pinned to the safe area, below the navigation bar, never under it.
  PDFView lays its pages out without honouring the automatic content inset a translucent
  bar adds, so UIKit's deceleration (toward the inset) and PDFView's layout (toward its own
  top) fought at the top edge and the page rested 37pt under the bar. Traced with an
  offset log on 2026-09-06; with no inset the rubber-band is monotonic.

### Persistence of ink

- File: `Library/pdf-ink/<key>.ink`. A binary property list encoding a `Codable`
  `InkArchive { version: Int, pageCount: Int, pages: [Int: Data] }`, where each `Data`
  is `PKDrawing.dataRepresentation()`. `version` is 1. Written with `.atomic`.
- `InkArchive` and its codec live in a UIKit-free file so they can be unit-tested with
  `swift test`.
- Save triggers, like Notes: `canvasViewDrawingDidChange` debounced 1 s; Done;
  `UIApplication.willResignActiveNotification`. If every page's drawing is empty the file
  is deleted, mirroring how an empty study note deletes its row.
- Load: on `open`, decode `inkPath` if it exists. Ink is laid over the PDF by page index.
  If the PDF now has fewer pages, ink for the missing indices stays in the archive and is
  not shown. If it has more pages, the new pages start empty.
- Corrupt or newer-than-known archive: rename it aside with a `.bad` suffix, start
  empty, log. Nothing is silently overwritten.
- Library is in the normal iOS device backup, as the downloads in Documents already are.
  Ink is irreplaceable, so that is wanted. Uninstalling the app removes it.

### Failure behaviour, native

- PDFKit cannot open the file: reject `unreadable` before presenting anything.
- A save fails (for example disk full): the next change retries. If the save triggered
  by Done fails, one `UIAlertController` says the ink could not be saved, with
  "Keep editing" and "Discard". The reader does not dismiss on "Keep editing".
- The app is killed while drawing: the 1 s debounce bounds the loss to the last second
  of strokes; the resign-active save covers backgrounding.

## PDF cache (`src/mobile/pdfCache.ts`)

Why: the ink then always sits on the exact bytes it was drawn on, opening is instant,
and annotated slides work offline or when IS is down.

- File: `LibraryNoCloud/pdf-ink/<key>.pdf`. No-cloud because the bytes are refetchable
  and a semester of slides should not bloat the device backup.
- Index: `LibraryNoCloud/pdf-ink/index.json`, one entry per key:
  `{ date: string, bytes: number, name: string, lastOpenedAt: number }`. `date` is the
  document date string IS shows in the file listing (`ParsedFile.date`), stored verbatim
  and compared by string equality. The index lives beside the files, not in IndexedDB,
  so a WebKit eviction can never orphan the PDFs. It is rewritten atomically after each
  change; a corrupt index is treated as empty and rebuilt from what the next opens
  write. The cap sweep lists the directory, so a `.pdf` with no index entry counts as
  least recently opened and is deleted first.
- `resolve(key, date)` returns `'fresh'` (entry exists, `entry.date === date`, file
  exists), `'stale'` (entry or file present but the date differs or the file is missing)
  or `'absent'`.
- Open policy in `openPdfWithInk`:
  1. `fresh` → open the cached copy. No network.
  2. `stale` or `absent` → `fetchIsBinary`. Binary → write, update the index, open.
     Not binary (IS served a viewer page) → the existing "cannot preview" fallback.
  3. Fetch threw and a copy exists (`stale`) → open the copy anyway (stale-if-error) and
     log. Fetch threw and nothing exists → the existing error path.
- After the reader closes, `lastOpenedAt` is updated and the cap is enforced: PDFs are
  evicted least-recently-opened first until the total is at or under **300 MB**. Ink
  files are never evicted. Deleting a PDF also deletes its index entry.
- The cache module takes its filesystem and clock as injected dependencies, so vitest
  drives it with an in-memory fake.

## Key

`key = sha256Hex(courseCode + ':' + fileLink)`, the same identity string the study notes
use (`getDocumentNoteKey`), hashed only because a URL is not a safe filename. Both the
ink file and the PDF file use it. `crypto.subtle` is already used in `src/utils/pkce.ts`.

## TypeScript integration

- `src/mobile/pdfInk.ts` (pattern: `src/mobile/eduroamNative.ts`):
  `registerPlugin<PdfInkPlugin>('PdfInk')`; `isPdfInkAvailable()` resolves once per
  session and is `false` anywhere but Capacitor on iOS; `openPdfWithInk(deps, input)`
  returns a discriminated result — `{ kind: 'shown' }`, `{ kind: 'unreadable', blob }`
  (caller falls back to the web viewer with the same bytes), `{ kind: 'notPdf' }`,
  `{ kind: 'failed', error }`. Dependencies (plugin, cache, fetch, token loader) are
  injected for tests, the same way `configureEduroam` takes `ConfigureEduroamDeps`.
- `useFileActions.openPdfInline` is split: `fetchPdfBlob(link): Promise<Blob | null>`
  does the platform-aware fetch that exists today; `openPdfInline` becomes
  `fetchPdfBlob` followed by `URL.createObjectURL`. Both the ink path and the web viewer
  consume the same fetched bytes, so a fallback never refetches.
- `usePdfPreview(courseCode)` gains the course argument (the sheet has it) and
  `viewPdf(link, name, date)` gains the document date. The branch order is: plugin
  available → `openPdfWithInk`; unavailable, or result `unreadable` → blob URL and
  `<PdfViewer>` exactly as now. The existing `isPreviewLoading` covers the fetch. While
  the native reader is presented the web UI is fully covered, so no new UI state exists.
- `FileList` / `FileListItem` pass `file.date` with the link on `onViewPdf`. That is the
  only list change.
- The desktop tree, iPhone, Android and the web preview do not change behaviour; the
  plugin is unavailable there and the code paths they take are the ones they take today.

## Privacy

reIS transmits nothing new. Ink and cached PDFs stay in the app sandbox. The
`noStudentDataLeaves` guard and `SUPABASE_CALLERS` are untouched. `PRIVACY.md` and
`docs/privacy-policy-app.md` need no new disclosure: this is local storage of the
student's own material, like the existing downloads and study notes.

## Testing

Test first, per the Iron Rules.

TypeScript (vitest):

- `pdfInk`: key derivation is stable and hex; availability is `false` in a browser, on
  Android, and on iOS when the plugin answers `false`; `openPdfWithInk` sequencing with
  fake deps — fresh copy opens without fetch; stale copy fetches once and rewrites;
  fetch failure with a stale copy opens the copy; `unreadable` returns the blob; the
  index is updated after close; the plugin's rejection codes map to result kinds.
- `pdfCache`: `resolve` for all three states; the index survives a corrupt file; the cap
  evicts least-recently-opened PDFs, never `.ink` files, and removes index entries with
  the files.
- `usePdfPreview` (extend `src/hooks/ui/__tests__/usePdfPreview.test.tsx`): plugin
  available → `open` called and no blob URL created; unavailable → blob URL as before;
  `unreadable` → blob URL from the same bytes with the fetch called once.
- `useFileActions`: `fetchPdfBlob` keeps the existing demo guard and the viewer-page
  `null`.

Swift:

- `InkArchive` round-trips through the codec; an unknown `version` decodes to a typed
  error. A `Tests/PdfInkPluginTests` target in the package, run with `swift test`. Neither
  existing plugin has tests; this adds the first, and the plan says how it is run.

Guards and CI: `check:app` is unaffected (the web build never reaches the plugin);
`noStudentDataLeaves` is unaffected.

Device checklist (`docs/superpowers/specs/2026-09-06-ipad-pdf-ink-verification-checklist.md`,
same format as the eduroam one; written with the plan, run on the physical iPad):

1. Open a subject PDF, draw on pages 1 and 3, Done, reopen → strokes present on both.
2. Pencil-only policy: a finger scrolls and never draws; a palm resting does nothing.
3. Tool picker's "Draw with Finger" switch on: a finger draws; off: a finger scrolls.
4. Zoom to the maximum PDFView allows and inspect stroke edges for softness (known
   PDFKit report, Apple forum 792941). Record the result either way.
5. Rotate the iPad while a page is inked; strokes stay on their content.
6. Draw, wait 2 s, kill the app from the switcher, reopen → the stroke is there.
7. Draw, background the app mid-session, return → nothing lost.
8. Second open of the same file with Wi-Fi off → opens instantly from the cache.
9. Re-upload simulation: change the stored index `date` for the key, reopen online →
   a fetch happens and the copy is replaced.
10. Corrupt PDF (write junk to the cached path) → the web viewer fallback shows.
11. iPhone, and an iPad on iPadOS 15 if available → the web viewer as today.
12. A 100+ page deck scrolls smoothly with ink on a dozen pages.
13. Light and dark system appearance.
14. Erase everything on a file, Done → the `.ink` file is gone (checked via the
    console log the plugin prints on delete).

The iOS simulator can exercise finger drawing only (no Pencil is paired, so `.default` lets a finger draw); the Pencil policy and
palm rejection need the physical iPad. Screenshots from the device via pymobiledevice3.

## Release

Ships in the next iOS train via `/release`. Android and the desktop stores are not part
of the train and are not affected.

## Sources

- react-pdf `Page.tsx` (no editor mode): https://github.com/wojtekmaj/react-pdf/blob/main/packages/react-pdf/src/Page.tsx
- pdf.js editor is viewer-internal: https://github.com/mozilla/pdf.js/issues/15712 ·
  iOS inking bug: https://github.com/mozilla/pdf.js/issues/20498
- WWDC22 "Display and edit PDFs with PDFKit" (overlay provider + PencilKit):
  https://developer.apple.com/videos/play/wwdc2022/10089/
- PDFView swallowing overlay touches: https://developer.apple.com/forums/thread/716766 ·
  overlay softness at zoom: https://developer.apple.com/forums/thread/792941
- QuickLook editing modes: https://www.kodeco.com/10447506-quicklook-previews-for-ios-getting-started/page/2
- WebKit one-input-type-at-a-time and Pencil pointer events:
  https://developer.apple.com/forums/thread/773213 · https://webkit.org/blog/16301/webkit-features-in-safari-18-2/
- WebKit storage eviction policy: https://webkit.org/blog/14403/updates-to-storage-policy/ ·
  Capacitor calls web storage transient: https://capacitorjs.com/docs/guides/storage ·
  persist request declined: https://github.com/ionic-team/capacitor/issues/7594
- Capacitor Filesystem directories: https://github.com/ionic-team/capacitor-filesystem/blob/main/src/definitions.ts
- Nutrient pricing and deprecated Ionic wrapper: https://www.nutrient.io/sdk/pricing/ ·
  https://www.nutrient.io/guides/android/ionic/ · Apryse Cordova status:
  https://docs.apryse.com/documentation/ios/guides/cordova/

## Addendum 2026-09-06: the reader is a Notes-style space for one subject

Approved after the first device run. Research (in the plan's Task 10 notes): iOS 26 renders
every system Done button as a filled tinted circle with a checkmark; the HIG reserves Done
for "the task is complete"; Notes, Freeform, GoodNotes, Notability, Procreate and Files
markup all autosave and leave a document through a top-left control back to a collection.

### Composition (all Apple components)

- `UISplitViewController(style: .doubleColumn)`, presented full screen.
  `preferredDisplayMode = .secondaryOnly` — the space opens on the page alone and picking a
  file hides the sidebar again; Apple's toggle is the only way it appears (a student who tapped
  a file wants to read it). `preferredSplitBehavior = .tile`,
  `primaryBackgroundStyle = .sidebar`, `displayModeButtonVisibility = .automatic` (Apple's
  sidebar toggle appears in the reader's bar), `presentsWithGesture = true`.
- Primary column: `FileListViewController`, a `UICollectionView` list with the `.sidebar`
  appearance listing the subject's PDF files: name, IS document date, and a pencil glyph
  accessory when an ink archive exists for the file. Title is the subject name. Its left bar
  item is a system **Close** — iOS renders it as a glass X glyph; it is the HIG control for a
  presented space. There is no Done anywhere.
- Secondary column: the existing `PdfInkViewController`, now able to `load` another file:
  it persists the current ink, drops canvases and drawings, swaps the `PDFDocument`, loads
  the new archive and re-takes first responder so the tool picker stays visible.
- `PdfInkSpace` coordinates the two: selection → load (cached) or ask the app for the bytes
  (spinner over the reader until they arrive); Close → persist, alert on a failed save as
  before, otherwise dismiss and resolve `open` with the links that were shown.

### Plugin API v2

```ts
open(o: {
  courseTitle: string;
  currentLink: string;
  files: { link: string; name: string; date: string; pdfPath: string | null; inkPath: string }[];
  strings: PdfInkStrings; // + openFailed
}): Promise<{ shown: string[] }>;          // links displayed, for lastOpenedAt + the cap
deliverFile(o: { link: string; pdfPath: string }): Promise<void>;
fileUnavailable(o: { link: string }): Promise<void>;
// event 'needsFile' { link } — the app fetches + caches, then calls deliverFile
```

`pdfPath` is the cached copy's URI when the copy is fresh for the file's date, else null.
Native decides `hasInk` itself from `inkPath`. A file PDFKit cannot open shows
`strings.openFailed` in the reader and stays in the list; the initial file keeps today's
fallback to the web viewer.

### TypeScript

`openPdfWithInk` gains `courseTitle` and `files` (the subject's PDF attachments: link, name,
date) and `fetchPdf(link)`. It resolves the initial file as before, builds the payload from
one index read, subscribes to `needsFile`, answers each with the same fetch → store path and
`deliverFile` (or `fileUnavailable`), and on resolve records `lastOpenedAt` for every shown
link and enforces the cap. `usePdfPreview(courseCode, subject)` receives
`{ title, files }` from the sheet; `listSubjectPdfs(files)` flattens the drawer's
`ParsedFile[]` into that list.

## Addendum 2026-09-07: what the branch grew past the design

The design describes one reader over one file. Four features were added after it,
each on the same principle — Apple's control, no mode, nothing rewritten in the PDF:

- **Add and remove a page.** Blank pages are recorded in the archive
  (`insertedPages`) and re-applied on open; the PDF is never rewritten.
  `InkPages` owns the index shifting.
- **Page grid and find-in-document.** Both are sheets over the reader
  (`PageGridViewController`, `SearchViewController`); the tool picker hides while
  one is up because it floats in its own window.
- **Share with notes.** `InkExport` redraws each page and stamps the `PKDrawing`
  over it, so the text stays text.

## Addendum 2026-09-07: covering an answer

A block over part of the page, so a lecture can be read back before the answer
is. Drag one out with the cover tool on; tap it to look under; tap again to shut
it. Tapping one while the tool is still on takes it away.

- **PencilKit cannot do this.** A stroke is not something you can tap. So covers
  are their own layer above the canvas (`CoverLayerView` inside
  `PageOverlayView`), with their rectangles in page coordinates.
- **It is invisible to everything else.** Outside a cover the layer's `hitTest`
  returns nothing, so drawing and scrolling reach the canvas exactly as before.
  Inside one it takes the touch — which is also why a covered patch cannot be
  drawn on. It is covered.
- **Making them is a mode, and a visible one** (the bar button fills in and the
  tool picker goes). Reading them is not: a tap opens and shuts a cover whenever
  the file is open.
- **Which covers are open is never saved.** Coming back to a file is exactly the
  moment the answers should be hidden again — that is the whole point.
- **Covers are not exported.** `InkExport` bakes in ink and nothing else: a
  shared PDF is the student's notes, and a study aid that travelled with it would
  hide the answer from whoever they sent it to. Decided, not inherited from the
  signature.
- **Archive v3** carries `covers`; v1 and v2 files read as having none, and a
  file whose only content is covers is no longer deleted on save.

`PageCovers` owns the one genuinely ambiguous part: while the tool is on, a drag
creates and a tap removes, and a short drag is a tap. A small cover drawn on top
of a big one is a new cover, never a delete.
