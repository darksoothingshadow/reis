# iPad PDF Ink Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On an iPad, a subject PDF opens in a native PDFKit + PencilKit reader whose ink persists on the device, and the PDF bytes are cached so the second open needs no network.

**Architecture:** A Swift Capacitor plugin (`native/capacitor-pdf-ink`) presents the reader and owns the ink file. A pure TypeScript cache module (`src/mobile/pdfCache.ts`) decides whether a stored PDF is current. A TypeScript bridge (`src/mobile/pdfInk.ts` + `pdfInkNative.ts`) sequences fetch → cache → open and reports a typed result so `usePdfPreview` can fall back to the existing pdf.js viewer. Spec: `docs/superpowers/specs/2026-09-06-ipad-pdf-ink-design.md`.

**Tech Stack:** Swift 5.9 (PDFKit, PencilKit, Capacitor 8 SPM), TypeScript, React 18 hooks, vitest, `@capacitor/filesystem` 8, `@capacitor/core` 8.

## Global Constraints

- iPad only, iPadOS 16 or newer. Deployment target stays `15.0`; the plugin answers `isAvailable: false` below 16 and on iPhone.
- The npm package name is `@reis/capacitor-pdf-ink`; `cap sync` derives the Swift package and product name `ReisCapacitorPdfInk` from it. Target name `PdfInkPlugin`, sources under `ios/Sources/PdfInkPlugin`. The `@objc(PdfInkPlugin)` class name must equal `<jsName>Plugin` (`jsName = "PdfInk"`).
- Ink file: `Library/pdf-ink/<key>.ink`. PDF cache: `LibraryNoCloud/pdf-ink/<key>.pdf` and `LibraryNoCloud/pdf-ink/index.json`. `key = sha256Hex(courseCode + ':' + fileLink)`.
- PDF cache cap: 300 MB, least-recently-opened first, `.pdf` files only.
- Save debounce 1 s; also on Done and `willResignActive`. Empty ink deletes the file. Corrupt ink is renamed with a `.bad` suffix.
- Canvases use `drawingPolicy = .default`; the tool picker shows Apple's own "Draw with Finger" control. No reIS toggle.
- Nothing is transmitted. No IndexedDB for any of this. No `localStorage`.
- Iron rules: max 200 lines per file, direct imports only, no `useEffect` for data fetching, DaisyUI classes only, test first.
- UI strings go through `useTranslation()` and both `src/i18n/locales/cs.json` and `en.json` under the `mobile` namespace (a guard test enforces identical key sets).
- Commit after every task. Never commit on `test` or `main`; this work is on branch `claude/pdf-ipad-editing-persistence-688805`.
- Run TypeScript tests with `npx vitest run <path>`; typecheck with `npm run typecheck`; lint with `npm run lint`.
- Do not run `npm run cap:ios` (it prompts and hangs). Use `npm run cap:sync` then `xcodebuild`.

---

## File map

| Path | Responsibility |
|---|---|
| `native/capacitor-pdf-ink/package.json`, `Package.swift`, `README.md` | Plugin packaging (Task 1) |
| `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/InkArchive.swift` | Codable ink container + binary plist codec, no UIKit (Task 1) |
| `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/InkStore.swift` | Load/save/delete/quarantine of the ink file, no UIKit (Task 1) |
| `native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/*.swift` | XCTest for the two files above (Task 1) |
| `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkStrings.swift` | Alert copy passed from JS (Task 2) |
| `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController.swift` | PDFView + PencilKit overlays + tool picker + saving (Task 2) |
| `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkPlugin.swift` | `isAvailable`, `open` (Task 2) |
| `src/mobile/pdfCache.ts` | Pure cache logic over an injected filesystem (Task 3) |
| `src/mobile/pdfInk.ts` | Plugin types, key derivation, `openPdfWithInk` sequencing (Task 4) |
| `src/mobile/pdfInkNative.ts` | `registerPlugin('PdfInk')`, availability, Capacitor Filesystem adapter (Task 5) |
| `src/test/guards/nativePluginsAreReachable.test.ts` | Add an `IOS_ONLY` allowance (Task 5) |
| `src/i18n/locales/{cs,en}.json` | `mobile.pdfInk.*` alert strings (Task 5) |
| `src/hooks/ui/useFileActions.ts` | Split `fetchPdfBlob` out of `openPdfInline` (Task 6) |
| `src/components/SubjectFileDrawer/{types,FileListItem,DrawerTabBody,SubjectFileDrawerContent}.tsx` | `onViewPdf(link, meta)` carries name + date (Task 7) |
| `src/hooks/ui/usePdfPreview.ts` | Branch to the native reader with fallbacks (Task 8) |
| `src/components/mobile/sheets/SubjectDrawerSheet.tsx` | Pass `courseCode` into `usePdfPreview` (Task 8) |
| `docs/superpowers/specs/2026-09-06-ipad-pdf-ink-verification-checklist.md` | Device gate (Task 9) |

---

### Task 1: Native package scaffold, `InkArchive`, `InkStore`, and their tests

**Files:**
- Create: `native/capacitor-pdf-ink/package.json`
- Create: `native/capacitor-pdf-ink/Package.swift`
- Create: `native/capacitor-pdf-ink/README.md`
- Create: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/InkArchive.swift`
- Create: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/InkStore.swift`
- Create: `native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/InkArchiveTests.swift`
- Create: `native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/InkStoreTests.swift`
- Modify: `package.json` (dependencies)

**Interfaces:**
- Produces (Swift): `struct InkArchive: Codable, Equatable { static let currentVersion = 1; var version: Int; var pageCount: Int; var pages: [Int: Data]; init(pageCount:pages:); func encoded() throws -> Data; static func decode(_:) throws -> InkArchive }`, `enum InkArchiveError: Error, Equatable { case unsupportedVersion(Int) }`, `enum InkStore { static func load(from: URL) -> InkArchive?; static func save(_:to:) throws; static func delete(at: URL) }`.

- [ ] **Step 1: Create the package manifest files**

`native/capacitor-pdf-ink/package.json`:

```json
{
  "name": "@reis/capacitor-pdf-ink",
  "version": "1.0.0",
  "private": true,
  "description": "iPad-only PDF reader with PencilKit ink (PDFKit + PKCanvasView + PKToolPicker). A local Capacitor plugin package, not published. iOS only by design — Android keeps the pdf.js viewer; see src/test/guards/nativePluginsAreReachable.test.ts IOS_ONLY.",
  "license": "Apache-2.0",
  "capacitor": {
    "ios": {
      "src": "ios"
    }
  },
  "files": [
    "ios/Sources",
    "Package.swift"
  ]
}
```

`native/capacitor-pdf-ink/Package.swift`:

```swift
// swift-tools-version: 5.9
import PackageDescription

// Same shape as native/capacitor-eduroam. `cap sync` reads the package.json next
// to this file, scans `ios/` for `@objc(...)` and generates BOTH the CapApp-SPM
// dependency and the packageClassList entry. The package and product name are
// derived from the npm name (`@reis/capacitor-pdf-ink` → `ReisCapacitorPdfInk`);
// a mismatch fails at dependency resolution.
//
// The test target cannot run with `swift test` on macOS because Capacitor is
// iOS-only and SwiftPM builds every target for tests. Run it through xcodebuild
// against an iPad simulator (README).
let package = Package(
    name: "ReisCapacitorPdfInk",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "ReisCapacitorPdfInk",
            targets: ["PdfInkPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "PdfInkPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
            ],
            path: "ios/Sources/PdfInkPlugin"),
        .testTarget(
            name: "PdfInkPluginTests",
            dependencies: ["PdfInkPlugin"],
            path: "ios/Tests/PdfInkPluginTests"),
    ]
)
```

`native/capacitor-pdf-ink/README.md`:

```markdown
# @reis/capacitor-pdf-ink

iPad-only PDF reader with Apple Pencil ink. `PDFView` shows the pages, a `PKCanvasView`
sits on each page (`PDFPageOverlayViewProvider`, iOS 16) and `PKToolPicker` is the palette.
Consumed by `src/mobile/pdfInkNative.ts` via `registerPlugin('PdfInk')`.

Local package, never published. The app depends on it as `file:native/capacitor-pdf-ink`.
Why a package and not a file in the app target: `native/capacitor-secure-store/README.md`.

There is no Android half on purpose — Android keeps the pdf.js viewer. The guard test
`src/test/guards/nativePluginsAreReachable.test.ts` lists `PdfInk` under `IOS_ONLY`.

## Files

- `ios/Sources/PdfInkPlugin/InkArchive.swift` — the ink file format (binary plist of
  `{version, pageCount, pages: [pageIndex: PKDrawing data]}`). Foundation only.
- `ios/Sources/PdfInkPlugin/InkStore.swift` — load/save/delete; a corrupt file is renamed
  `*.ink.bad` rather than overwritten. Foundation only.
- `ios/Sources/PdfInkPlugin/PdfInkViewController.swift` — the reader.
- `ios/Sources/PdfInkPlugin/PdfInkPlugin.swift` — `isAvailable`, `open`.

## Tests

`swift test` cannot run here: Capacitor is iOS-only and SwiftPM builds every target. Use
an iPad simulator instead (first run resolves capacitor-swift-pm, a few minutes):

    cd native/capacitor-pdf-ink
    xcodebuild test -scheme ReisCapacitorPdfInk-Package \
      -destination 'platform=iOS Simulator,name=iPad Air 11-inch (M4)'

`xcodebuild -list` shows the scheme names if the simulator name or scheme differs.
```

- [ ] **Step 2: Write the failing Swift tests**

`native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/InkArchiveTests.swift`:

```swift
import XCTest
@testable import PdfInkPlugin

final class InkArchiveTests: XCTestCase {
    func testRoundTripsPagesAndPageCount() throws {
        let archive = InkArchive(pageCount: 12, pages: [0: Data([1, 2, 3]), 7: Data([9])])
        let decoded = try InkArchive.decode(archive.encoded())
        XCTAssertEqual(decoded, archive)
        XCTAssertEqual(decoded.version, InkArchive.currentVersion)
    }

    func testRejectsANewerVersion() throws {
        var archive = InkArchive(pageCount: 1, pages: [:])
        archive.version = InkArchive.currentVersion + 1
        XCTAssertThrowsError(try InkArchive.decode(archive.encoded())) { error in
            XCTAssertEqual(
                error as? InkArchiveError,
                .unsupportedVersion(InkArchive.currentVersion + 1))
        }
    }

    func testRejectsJunk() {
        XCTAssertThrowsError(try InkArchive.decode(Data("not a plist".utf8)))
    }
}
```

`native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/InkStoreTests.swift`:

```swift
import XCTest
@testable import PdfInkPlugin

final class InkStoreTests: XCTestCase {
    private var dir: URL!

    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: dir)
    }

    func testSaveCreatesDirectoriesAndLoadReadsBack() throws {
        let url = dir.appendingPathComponent("pdf-ink/abc.ink")
        let archive = InkArchive(pageCount: 3, pages: [1: Data([4, 5])])
        try InkStore.save(archive, to: url)
        XCTAssertEqual(InkStore.load(from: url), archive)
    }

    func testMissingFileLoadsAsNil() {
        XCTAssertNil(InkStore.load(from: dir.appendingPathComponent("none.ink")))
    }

    func testCorruptFileIsQuarantinedNotOverwritten() throws {
        let url = dir.appendingPathComponent("bad.ink")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try Data("garbage".utf8).write(to: url)
        XCTAssertNil(InkStore.load(from: url))
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))
        XCTAssertTrue(
            FileManager.default.fileExists(atPath: url.appendingPathExtension("bad").path))
    }

    func testDeleteRemovesTheFile() throws {
        let url = dir.appendingPathComponent("gone.ink")
        try InkStore.save(InkArchive(pageCount: 1, pages: [0: Data([1])]), to: url)
        InkStore.delete(at: url)
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))
    }
}
```

- [ ] **Step 3: Add a placeholder source file so the package resolves, then run the tests to see them fail**

Create `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/InkArchive.swift` containing only:

```swift
import Foundation
```

Run:

```bash
cd native/capacitor-pdf-ink && xcodebuild -list 2>&1 | sed -n '/Schemes/,$p'
```

Expected: a `Schemes:` list containing `ReisCapacitorPdfInk-Package` (and `ReisCapacitorPdfInk`). If only `ReisCapacitorPdfInk` is listed, use that name below.

```bash
cd native/capacitor-pdf-ink && xcodebuild test -scheme ReisCapacitorPdfInk-Package -destination 'platform=iOS Simulator,name=iPad Air 11-inch (M4)' 2>&1 | grep -E "error:|TEST|BUILD" | head -20
```

Expected: `** TEST FAILED **` (or `BUILD FAILED`) with errors such as `cannot find 'InkArchive' in scope`. The first run resolves `capacitor-swift-pm` and takes a few minutes.

- [ ] **Step 4: Implement `InkArchive`**

`native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/InkArchive.swift`:

```swift
import Foundation

/**
 * The on-disk shape of one PDF's ink: a binary property list of
 * `{version, pageCount, pages: [pageIndex: PKDrawing.dataRepresentation()]}`.
 *
 * Foundation only — no PencilKit, no UIKit — so it can be unit-tested and so the
 * format is readable without a canvas. `pageCount` is what the PDF had when the
 * ink was saved; the reader lays ink over the current PDF by page index and keeps
 * (but does not show) ink for pages that no longer exist.
 */
struct InkArchive: Codable, Equatable {
    static let currentVersion = 1

    var version: Int
    var pageCount: Int
    var pages: [Int: Data]

    init(pageCount: Int, pages: [Int: Data]) {
        self.version = Self.currentVersion
        self.pageCount = pageCount
        self.pages = pages
    }

    func encoded() throws -> Data {
        let encoder = PropertyListEncoder()
        encoder.outputFormat = .binary
        return try encoder.encode(self)
    }

    /// Fails on junk and on a file written by a NEWER reIS: reading it with an
    /// older decoder could silently drop strokes, and the caller quarantines the
    /// file instead.
    static func decode(_ data: Data) throws -> InkArchive {
        let archive = try PropertyListDecoder().decode(InkArchive.self, from: data)
        guard archive.version <= currentVersion else {
            throw InkArchiveError.unsupportedVersion(archive.version)
        }
        return archive
    }
}

enum InkArchiveError: Error, Equatable {
    case unsupportedVersion(Int)
}
```

- [ ] **Step 5: Implement `InkStore`**

`native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/InkStore.swift`:

```swift
import Foundation

/**
 * The ink file's only reader and writer. Writes are atomic; a file that does not
 * decode is moved aside as `<name>.ink.bad` so nothing the student drew is
 * silently overwritten, and the reader starts empty.
 */
enum InkStore {
    static func load(from url: URL) -> InkArchive? {
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        do {
            return try InkArchive.decode(try Data(contentsOf: url))
        } catch {
            NSLog("PdfInk: ink at \(url.lastPathComponent) unreadable (\(error)); quarantined")
            quarantine(url)
            return nil
        }
    }

    static func save(_ archive: InkArchive, to url: URL) throws {
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try archive.encoded().write(to: url, options: .atomic)
    }

    static func delete(at url: URL) {
        try? FileManager.default.removeItem(at: url)
        NSLog("PdfInk: ink deleted for \(url.lastPathComponent)")
    }

    private static func quarantine(_ url: URL) {
        let bad = url.appendingPathExtension("bad")
        try? FileManager.default.removeItem(at: bad)
        try? FileManager.default.moveItem(at: url, to: bad)
    }
}
```

- [ ] **Step 6: Run the Swift tests to verify they pass**

```bash
cd native/capacitor-pdf-ink && xcodebuild test -scheme ReisCapacitorPdfInk-Package -destination 'platform=iOS Simulator,name=iPad Air 11-inch (M4)' 2>&1 | grep -E "error:|Executed|TEST" | tail -5
```

Expected: `Executed 7 tests, with 0 failures` and `** TEST SUCCEEDED **`.

- [ ] **Step 7: Declare the dependency and install it**

In `package.json`, next to `"@reis/capacitor-eduroam": "file:native/capacitor-eduroam",` add:

```json
    "@reis/capacitor-pdf-ink": "file:native/capacitor-pdf-ink",
```

Run:

```bash
npm install --no-audit --no-fund 2>&1 | tail -2 && npm run check:native
```

Expected: `native plugins: 3 declared, all installed`.

- [ ] **Step 8: Commit**

```bash
git add native/capacitor-pdf-ink package.json package-lock.json
git commit -m "feat(pdf-ink): native package scaffold with the ink archive format and store

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The reader — `PdfInkStrings`, `PdfInkViewController`, `PdfInkPlugin`

**Files:**
- Create: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkStrings.swift`
- Create: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController.swift`
- Create: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkPlugin.swift`

**Interfaces:**
- Consumes: `InkArchive`, `InkStore` from Task 1.
- Produces (JS contract): plugin `jsName = "PdfInk"` with `isAvailable() → { available: Bool }` and `open({ pdfPath, inkPath, title, strings: { saveFailedTitle, saveFailedMessage, keepEditing, discard } }) → { hasInk: Bool }`; `open` rejects with code `unreadable` when PDFKit cannot open the file, `unavailable` off-iPad or below iOS 16, `badArguments` on missing paths.

There is no XCTest for this task: the deliverable is UIKit presented over the Capacitor bridge. The test is that the app compiles with the plugin registered (Step 4) and the device checklist in Task 9.

- [ ] **Step 1: Write `PdfInkStrings.swift`**

```swift
import Capacitor
import Foundation

/**
 * Copy for the one dialog the reader can show (a failed save), translated by the
 * app and passed in with `open`. The English fallbacks only ever show if the JS
 * side forgot a key; the i18n guard test makes that unlikely.
 */
struct PdfInkStrings {
    let saveFailedTitle: String
    let saveFailedMessage: String
    let keepEditing: String
    let discard: String

    init(_ object: JSObject?) {
        saveFailedTitle = object?["saveFailedTitle"] as? String ?? "Your ink couldn't be saved"
        saveFailedMessage =
            object?["saveFailedMessage"] as? String
            ?? "There may be no space left on this iPad."
        keepEditing = object?["keepEditing"] as? String ?? "Keep editing"
        discard = object?["discard"] as? String ?? "Discard"
    }
}
```

- [ ] **Step 2: Write `PdfInkViewController.swift`**

```swift
import PDFKit
import PencilKit
import UIKit

/**
 * A PDFView that can be first responder — so the tool picker has something to be
 * visible for between pages — and that routes undo/redo to the canvas the student
 * last drew on, which is where the picker's undo buttons look.
 */
@available(iOS 16.0, *)
final class InkPDFView: PDFView {
    weak var activeCanvas: PKCanvasView?
    override var canBecomeFirstResponder: Bool { true }
    override var undoManager: UndoManager? { activeCanvas?.undoManager ?? super.undoManager }
}

/**
 * The reader. PDFKit renders and lays out the pages; PencilKit draws. Everything
 * the student touches is Apple's:
 *
 * - `PDFPageOverlayViewProvider` (iOS 16) puts one `PKCanvasView` over each page
 *   PDFKit is displaying. `usePageViewController(false)` + `isInMarkupMode` are
 *   what let touches reach the canvas instead of PDFView (Apple forum 716766).
 * - `drawingPolicy = .default` + `showsDrawingPolicyControls`: with a Pencil
 *   paired a finger scrolls and the picker's own "Draw with Finger" switch turns
 *   finger drawing on; without a Pencil a finger draws. No reIS toggle.
 * - Drawings, not canvases, are the source of truth: `drawings[pageIndex]`.
 *   PDFKit asks for overlays as pages scroll in and releases them as they scroll
 *   out, so a 200-page deck holds 200 small drawings and a handful of canvases.
 *
 * Saving is Notes-like: 1 s after the last stroke, on Done, and when the app
 * resigns active. Empty ink deletes the file.
 */
@available(iOS 16.0, *)
final class PdfInkViewController: UIViewController, PDFPageOverlayViewProvider,
    PKCanvasViewDelegate
{
    private let document: PDFDocument
    private let inkURL: URL
    private let strings: PdfInkStrings
    private let onDismiss: (Bool) -> Void

    private let pdfView = InkPDFView()
    private let toolPicker = PKToolPicker()
    private var drawings: [Int: PKDrawing] = [:]
    private var canvases: [Int: PKCanvasView] = [:]
    private var saveTimer: Timer?
    private var lastSaveError: Error?
    private var finished = false

    init(
        document: PDFDocument, inkURL: URL, title: String, strings: PdfInkStrings,
        onDismiss: @escaping (Bool) -> Void
    ) {
        self.document = document
        self.inkURL = inkURL
        self.strings = strings
        self.onDismiss = onDismiss
        super.init(nibName: nil, bundle: nil)
        self.title = title
        if let archive = InkStore.load(from: inkURL) {
            for (index, data) in archive.pages {
                if let drawing = try? PKDrawing(data: data) { drawings[index] = drawing }
            }
        }
    }

    required init?(coder: NSCoder) { fatalError("PdfInkViewController is code-only") }

    deinit {
        NotificationCenter.default.removeObserver(self)
        saveTimer?.invalidate()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        // A system item: iOS localises "Done" itself.
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .done, target: self, action: #selector(doneTapped))

        pdfView.document = document
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        pdfView.autoScales = true
        pdfView.usePageViewController(false)
        pdfView.isInMarkupMode = true
        pdfView.pageOverlayViewProvider = self
        pdfView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(pdfView)
        NSLayoutConstraint.activate([
            pdfView.topAnchor.constraint(equalTo: view.topAnchor),
            pdfView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            pdfView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            pdfView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        toolPicker.showsDrawingPolicyControls = true
        toolPicker.setVisible(true, forFirstResponder: pdfView)

        NotificationCenter.default.addObserver(
            self, selector: #selector(persistNow),
            name: UIApplication.willResignActiveNotification, object: nil)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        pdfView.becomeFirstResponder()
    }

    // MARK: - PDFPageOverlayViewProvider

    func pdfView(_ view: PDFView, overlayViewFor page: PDFPage) -> UIView? {
        let index = document.index(for: page)
        if let canvas = canvases[index] { return canvas }
        let canvas = PKCanvasView()
        canvas.tag = index
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        canvas.drawingPolicy = .default
        canvas.drawing = drawings[index] ?? PKDrawing()
        canvas.tool = toolPicker.selectedTool
        canvas.delegate = self
        toolPicker.addObserver(canvas)
        toolPicker.setVisible(true, forFirstResponder: canvas)
        canvases[index] = canvas
        return canvas
    }

    func pdfView(
        _ view: PDFView, willEndDisplayingOverlayView overlayView: UIView, for page: PDFPage
    ) {
        let index = document.index(for: page)
        if let canvas = overlayView as? PKCanvasView {
            drawings[index] = canvas.drawing
            toolPicker.removeObserver(canvas)
            if pdfView.activeCanvas === canvas { pdfView.activeCanvas = nil }
        }
        canvases[index] = nil
    }

    // MARK: - PKCanvasViewDelegate

    func canvasViewDidBeginUsingTool(_ canvasView: PKCanvasView) {
        pdfView.activeCanvas = canvasView
    }

    func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
        drawings[canvasView.tag] = canvasView.drawing
        saveTimer?.invalidate()
        saveTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: false) {
            [weak self] _ in self?.persistNow()
        }
    }

    // MARK: - Saving

    private func currentArchive() -> InkArchive {
        for (index, canvas) in canvases { drawings[index] = canvas.drawing }
        let pages = drawings.filter { !$0.value.strokes.isEmpty }
            .mapValues { $0.dataRepresentation() }
        return InkArchive(pageCount: document.pageCount, pages: pages)
    }

    @objc private func persistNow() {
        saveTimer?.invalidate()
        saveTimer = nil
        let archive = currentArchive()
        do {
            if archive.pages.isEmpty {
                InkStore.delete(at: inkURL)
            } else {
                try InkStore.save(archive, to: inkURL)
            }
            lastSaveError = nil
        } catch {
            lastSaveError = error
            NSLog("PdfInk: save failed: \(error)")
        }
    }

    @objc private func doneTapped() {
        persistNow()
        guard let error = lastSaveError else {
            finish()
            return
        }
        let alert = UIAlertController(
            title: strings.saveFailedTitle,
            message: "\(strings.saveFailedMessage)\n\n\(error.localizedDescription)",
            preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: strings.keepEditing, style: .cancel))
        alert.addAction(
            UIAlertAction(title: strings.discard, style: .destructive) { [weak self] _ in
                self?.finish()
            })
        present(alert, animated: true)
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        let hasInk = !currentArchive().pages.isEmpty
        toolPicker.setVisible(false, forFirstResponder: pdfView)
        dismiss(animated: true) { [onDismiss] in onDismiss(hasInk) }
    }
}
```

- [ ] **Step 3: Write `PdfInkPlugin.swift`**

```swift
import Capacitor
import Foundation
import PDFKit
import UIKit

/**
 * `PdfInk`: opens a PDF in a native PencilKit reader and resolves when the
 * student taps Done. iPad + iPadOS 16 only; JS asks `isAvailable` first and keeps
 * the pdf.js viewer everywhere else.
 *
 * Rejection codes the JS side branches on: `unreadable` (PDFKit cannot open the
 * file — JS falls back to the web viewer with the same bytes), `unavailable`,
 * `badArguments`, `noHost`.
 */
@objc(PdfInkPlugin)
public class PdfInkPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PdfInkPlugin"
    public let jsName = "PdfInk"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
    ]

    private static var supported: Bool {
        guard #available(iOS 16.0, *) else { return false }
        return UIDevice.current.userInterfaceIdiom == .pad
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": Self.supported])
    }

    @objc func open(_ call: CAPPluginCall) {
        guard Self.supported else {
            call.reject("PdfInk needs an iPad on iPadOS 16 or newer", "unavailable")
            return
        }
        guard let pdfPath = call.getString("pdfPath"), let inkPath = call.getString("inkPath"),
            let pdfURL = Self.fileURL(pdfPath), let inkURL = Self.fileURL(inkPath)
        else {
            call.reject("open requires pdfPath and inkPath as file URIs", "badArguments")
            return
        }
        let title = call.getString("title") ?? pdfURL.lastPathComponent
        let strings = PdfInkStrings(call.getObject("strings"))

        DispatchQueue.main.async {
            // `supported` already proved this; the guard is for the compiler.
            guard #available(iOS 16.0, *) else { return }
            guard let document = PDFDocument(url: pdfURL), document.pageCount > 0 else {
                call.reject("PDFKit could not open \(pdfURL.lastPathComponent)", "unreadable")
                return
            }
            guard let host = self.bridge?.viewController else {
                call.reject("no view controller to present from", "noHost")
                return
            }
            let reader = PdfInkViewController(
                document: document, inkURL: inkURL, title: title, strings: strings
            ) { hasInk in
                call.resolve(["hasInk": hasInk])
            }
            let nav = UINavigationController(rootViewController: reader)
            nav.modalPresentationStyle = .fullScreen
            host.present(nav, animated: true)
        }
    }

    /// Capacitor's `Filesystem.getUri` returns `file:///…`; a bare path is accepted too.
    static func fileURL(_ s: String) -> URL? {
        if let url = URL(string: s), url.isFileURL { return url }
        if s.hasPrefix("/") { return URL(fileURLWithPath: s) }
        return nil
    }
}
```

- [ ] **Step 4: Sync and compile the app with the plugin registered**

```bash
npm run cap:sync 2>&1 | grep -E "capacitor-pdf-ink|Found .* plugins|error" ; grep -o '"PdfInkPlugin"' ios/App/App/capacitor.config.json; grep -c ReisCapacitorPdfInk ios/App/CapApp-SPM/Package.swift
```

Expected: the plugin listed among the found plugins, `"PdfInkPlugin"` printed once, and `2` (one dependency line, one product line) or at least `1`.

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'platform=iOS Simulator,name=iPad Air 11-inch (M4)' build 2>&1 | grep -E "error:|warning: .*PdfInk|BUILD" | tail -10
```

Expected: `** BUILD SUCCEEDED **`. A deprecation warning on `selectedTool` (iOS 18) is acceptable; an `error:` line is not.

- [ ] **Step 5: Re-run the Swift tests (the package still builds with the new files)**

```bash
cd native/capacitor-pdf-ink && xcodebuild test -scheme ReisCapacitorPdfInk-Package -destination 'platform=iOS Simulator,name=iPad Air 11-inch (M4)' 2>&1 | grep -E "error:|Executed|TEST" | tail -5
```

Expected: `Executed 7 tests, with 0 failures`, `** TEST SUCCEEDED **`.

- [ ] **Step 6: Commit**

```bash
git add native/capacitor-pdf-ink
git commit -m "feat(pdf-ink): PDFKit + PencilKit reader behind the PdfInk plugin

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `pdfCache.ts` — pure cache logic over an injected filesystem

**Files:**
- Create: `src/mobile/pdfCache.ts`
- Create: `src/mobile/__tests__/memPdfCacheFs.ts` (in-memory `PdfCacheFs` shared by Tasks 3, 4)
- Test: `src/mobile/__tests__/pdfCache.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const PDF_CACHE_DIR = 'pdf-ink';
  export const PDF_CACHE_CAP_BYTES = 300 * 1024 * 1024;
  export interface PdfCacheEntry { date: string; bytes: number; name: string; lastOpenedAt: number }
  export type PdfCacheIndex = Record<string, PdfCacheEntry>;
  export type PdfCacheState = 'fresh' | 'stale' | 'absent';
  export interface PdfCacheFs {
    readText(path: string): Promise<string | null>;
    writeText(path: string, text: string): Promise<void>;
    writeBase64(path: string, base64: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    list(dir: string): Promise<{ name: string; size: number }[]>;
    remove(path: string): Promise<void>;
    uri(path: string): Promise<string>;
  }
  export function pdfPath(key: string): string;
  export function readIndex(fs: PdfCacheFs): Promise<PdfCacheIndex>;
  export function resolve(fs: PdfCacheFs, key: string, date: string): Promise<PdfCacheState>;
  export function store(fs: PdfCacheFs, key: string, blob: Blob, meta: { date: string; name: string }, now: number): Promise<void>;
  export function recordOpen(fs: PdfCacheFs, key: string, now: number): Promise<void>;
  export function forget(fs: PdfCacheFs, key: string): Promise<void>;
  export function enforceCap(fs: PdfCacheFs, capBytes?: number): Promise<string[]>;
  ```
  All paths are relative to the no-cloud Library directory; the adapter in Task 5 picks the `Directory`.

- [ ] **Step 1: Write the in-memory filesystem helper and the failing tests**

`src/mobile/__tests__/memPdfCacheFs.ts` (a helper, not a test file — vitest only runs `*.test.ts`, so importing it from two test files runs nothing twice):

```ts
import type { PdfCacheFs } from '../pdfCache';

/** In-memory PdfCacheFs. Sizes are what `list` reports, so tests can seed them. */
export function memFs() {
  const files = new Map<string, { text?: string; base64?: string; size: number }>();
  const fs: PdfCacheFs = {
    readText: async (p) => files.get(p)?.text ?? null,
    writeText: async (p, t) => void files.set(p, { text: t, size: t.length }),
    writeBase64: async (p, b) =>
      void files.set(p, { base64: b, size: Math.floor((b.length * 3) / 4) }),
    exists: async (p) => files.has(p),
    list: async (dir) =>
      [...files.entries()]
        .filter(([p]) => p.startsWith(`${dir}/`))
        .map(([p, f]) => ({ name: p.slice(dir.length + 1), size: f.size })),
    remove: async (p) => void files.delete(p),
    uri: async (p) => `file:///lib/${p}`,
  };
  return { fs, files };
}
```

`src/mobile/__tests__/pdfCache.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { memFs } from './memPdfCacheFs';
import {
  PDF_CACHE_DIR,
  enforceCap,
  forget,
  pdfPath,
  readIndex,
  recordOpen,
  resolve,
  store,
} from '../pdfCache';

const pdf = () => new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' });

describe('pdfCache.resolve', () => {
  it('is absent when neither the index nor the file knows the key', async () => {
    const { fs } = memFs();
    expect(await resolve(fs, 'k1', '12. 3. 2026')).toBe('absent');
  });

  it('is fresh when the file exists and the IS document date is unchanged', async () => {
    const { fs } = memFs();
    await store(fs, 'k1', pdf(), { date: '12. 3. 2026', name: 'Přednáška 09' }, 1000);
    expect(await resolve(fs, 'k1', '12. 3. 2026')).toBe('fresh');
  });

  it('is stale when the teacher re-uploaded (date changed)', async () => {
    const { fs } = memFs();
    await store(fs, 'k1', pdf(), { date: '12. 3. 2026', name: 'Přednáška 09' }, 1000);
    expect(await resolve(fs, 'k1', '19. 3. 2026')).toBe('stale');
  });

  it('is stale when the index knows the key but the file is gone', async () => {
    const { fs, files } = memFs();
    await store(fs, 'k1', pdf(), { date: 'd', name: 'n' }, 1000);
    files.delete(pdfPath('k1'));
    expect(await resolve(fs, 'k1', 'd')).toBe('stale');
  });

  it('is stale when the file exists but the index was lost', async () => {
    const { fs, files } = memFs();
    files.set(pdfPath('k1'), { size: 10 });
    expect(await resolve(fs, 'k1', 'd')).toBe('stale');
  });
});

describe('pdfCache index', () => {
  it('records date, size, name and lastOpenedAt on store', async () => {
    const { fs } = memFs();
    const blob = pdf();
    await store(fs, 'k1', blob, { date: 'd', name: 'Slides' }, 1000);
    expect(await readIndex(fs)).toEqual({
      k1: { date: 'd', bytes: blob.size, name: 'Slides', lastOpenedAt: 1000 },
    });
  });

  it('bumps lastOpenedAt on recordOpen and ignores unknown keys', async () => {
    const { fs } = memFs();
    await store(fs, 'k1', pdf(), { date: 'd', name: 'n' }, 1000);
    await recordOpen(fs, 'k1', 2000);
    await recordOpen(fs, 'nope', 3000);
    const index = await readIndex(fs);
    expect(index.k1?.lastOpenedAt).toBe(2000);
    expect(index.nope).toBeUndefined();
  });

  it('treats a corrupt index as empty instead of throwing', async () => {
    const { fs } = memFs();
    await fs.writeText(`${PDF_CACHE_DIR}/index.json`, '{not json');
    expect(await readIndex(fs)).toEqual({});
    await fs.writeText(`${PDF_CACHE_DIR}/index.json`, '[1,2]');
    expect(await readIndex(fs)).toEqual({});
  });

  it('forget removes the file and the entry', async () => {
    const { fs, files } = memFs();
    await store(fs, 'k1', pdf(), { date: 'd', name: 'n' }, 1000);
    await forget(fs, 'k1');
    expect(files.has(pdfPath('k1'))).toBe(false);
    expect(await readIndex(fs)).toEqual({});
  });
});

describe('pdfCache.enforceCap', () => {
  it('does nothing under the cap', async () => {
    const { fs, files } = memFs();
    await store(fs, 'a', pdf(), { date: 'd', name: 'a' }, 1);
    files.set(pdfPath('a'), { size: 100 });
    expect(await enforceCap(fs, 1000)).toEqual([]);
    expect(files.has(pdfPath('a'))).toBe(true);
  });

  it('evicts least-recently-opened PDFs first until under the cap', async () => {
    const { fs, files } = memFs();
    await store(fs, 'old', pdf(), { date: 'd', name: 'old' }, 1);
    await store(fs, 'mid', pdf(), { date: 'd', name: 'mid' }, 2);
    await store(fs, 'new', pdf(), { date: 'd', name: 'new' }, 3);
    for (const k of ['old', 'mid', 'new']) files.set(pdfPath(k), { size: 400 });
    expect(await enforceCap(fs, 1000)).toEqual(['old']);
    expect(files.has(pdfPath('old'))).toBe(false);
    expect(files.has(pdfPath('mid'))).toBe(true);
    expect(Object.keys(await readIndex(fs)).sort()).toEqual(['mid', 'new']);
  });

  it('counts a PDF with no index entry as the oldest, and never touches other files', async () => {
    const { fs, files } = memFs();
    await store(fs, 'known', pdf(), { date: 'd', name: 'known' }, 5);
    files.set(pdfPath('known'), { size: 600 });
    files.set(`${PDF_CACHE_DIR}/orphan.pdf`, { size: 600 });
    files.set(`${PDF_CACHE_DIR}/notes.ink`, { size: 600 });
    expect(await enforceCap(fs, 1000)).toEqual(['orphan']);
    expect(files.has(`${PDF_CACHE_DIR}/notes.ink`)).toBe(true);
    expect(files.has(pdfPath('known'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/mobile/__tests__/pdfCache.test.ts 2>&1 | tail -5
```

Expected: FAIL — `Failed to resolve import "../pdfCache"`.

- [ ] **Step 3: Implement `pdfCache.ts`**

```ts
import { blobToBase64 } from '../api/capacitorBinary';

/**
 * Where the iPad reader keeps the PDF bytes it has opened, and whether a copy is
 * still the one IS serves.
 *
 * Why cache at all: the ink then always sits on the exact bytes it was drawn on,
 * a second open is instant, and annotated slides work offline. Why here and not
 * IndexedDB: WebKit may evict a Capacitor app's IndexedDB under disk pressure;
 * files in the app's Library are not evicted. The index lives beside the files
 * so an eviction can never orphan the PDFs either.
 *
 * Pure logic over an injected `PdfCacheFs` (relative paths under the no-cloud
 * Library directory), so vitest drives it with an in-memory fake. The Capacitor
 * adapter is in pdfInkNative.ts.
 */
export const PDF_CACHE_DIR = 'pdf-ink';
export const PDF_CACHE_INDEX = `${PDF_CACHE_DIR}/index.json`;
export const PDF_CACHE_CAP_BYTES = 300 * 1024 * 1024;

export interface PdfCacheEntry {
  /** IS's document date string, stored verbatim; a re-upload changes it. */
  date: string;
  bytes: number;
  name: string;
  lastOpenedAt: number;
}
export type PdfCacheIndex = Record<string, PdfCacheEntry>;
export type PdfCacheState = 'fresh' | 'stale' | 'absent';

export interface PdfCacheFs {
  readText(path: string): Promise<string | null>;
  writeText(path: string, text: string): Promise<void>;
  writeBase64(path: string, base64: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  list(dir: string): Promise<{ name: string; size: number }[]>;
  remove(path: string): Promise<void>;
  uri(path: string): Promise<string>;
}

export function pdfPath(key: string): string {
  return `${PDF_CACHE_DIR}/${key}.pdf`;
}

export async function readIndex(fs: PdfCacheFs): Promise<PdfCacheIndex> {
  const text = await fs.readText(PDF_CACHE_INDEX);
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as PdfCacheIndex;
  } catch {
    // A corrupt index is rebuilt by the next opens; orphaned PDFs are the cap
    // sweep's job (a `.pdf` with no entry counts as least recently opened).
    return {};
  }
}

async function writeIndex(fs: PdfCacheFs, index: PdfCacheIndex): Promise<void> {
  await fs.writeText(PDF_CACHE_INDEX, JSON.stringify(index));
}

export async function resolve(fs: PdfCacheFs, key: string, date: string): Promise<PdfCacheState> {
  const entry = (await readIndex(fs))[key];
  const present = await fs.exists(pdfPath(key));
  if (!entry && !present) return 'absent';
  if (entry && present && entry.date === date) return 'fresh';
  return 'stale';
}

export async function store(
  fs: PdfCacheFs,
  key: string,
  blob: Blob,
  meta: { date: string; name: string },
  now: number
): Promise<void> {
  await fs.writeBase64(pdfPath(key), await blobToBase64(blob));
  const index = await readIndex(fs);
  index[key] = { date: meta.date, bytes: blob.size, name: meta.name, lastOpenedAt: now };
  await writeIndex(fs, index);
}

export async function recordOpen(fs: PdfCacheFs, key: string, now: number): Promise<void> {
  const index = await readIndex(fs);
  const entry = index[key];
  if (!entry) return;
  index[key] = { ...entry, lastOpenedAt: now };
  await writeIndex(fs, index);
}

/** Drop a copy PDFKit could not open, so the next open fetches afresh. */
export async function forget(fs: PdfCacheFs, key: string): Promise<void> {
  await fs.remove(pdfPath(key)).catch(() => {});
  const index = await readIndex(fs);
  if (key in index) {
    delete index[key];
    await writeIndex(fs, index);
  }
}

/** Evicts least-recently-opened `.pdf` files until the total is under the cap. Returns evicted keys. */
export async function enforceCap(
  fs: PdfCacheFs,
  capBytes: number = PDF_CACHE_CAP_BYTES
): Promise<string[]> {
  const pdfs = (await fs.list(PDF_CACHE_DIR)).filter((f) => f.name.endsWith('.pdf'));
  let total = pdfs.reduce((n, f) => n + f.size, 0);
  if (total <= capBytes) return [];
  const index = await readIndex(fs);
  const byAge = pdfs
    .map((f) => {
      const key = f.name.slice(0, -'.pdf'.length);
      return { ...f, key, lastOpenedAt: index[key]?.lastOpenedAt ?? 0 };
    })
    .sort((a, b) => a.lastOpenedAt - b.lastOpenedAt);
  const evicted: string[] = [];
  for (const f of byAge) {
    if (total <= capBytes) break;
    await fs.remove(`${PDF_CACHE_DIR}/${f.name}`);
    delete index[f.key];
    total -= f.size;
    evicted.push(f.key);
  }
  await writeIndex(fs, index);
  return evicted;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/mobile/__tests__/pdfCache.test.ts 2>&1 | tail -5
```

Expected: `Tests  12 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/mobile/pdfCache.ts src/mobile/__tests__/memPdfCacheFs.ts src/mobile/__tests__/pdfCache.test.ts
git commit -m "feat(pdf-ink): on-device PDF cache keyed by course and link, validated by IS document date

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `pdfInk.ts` — key derivation and the fetch → cache → open sequence

**Files:**
- Create: `src/mobile/pdfInk.ts`
- Test: `src/mobile/__tests__/pdfInk.test.ts`

**Interfaces:**
- Consumes: everything exported by `src/mobile/pdfCache.ts` (Task 3); `logError(context, err)` from `src/utils/reportError.ts`.
- Produces:
  ```ts
  export interface PdfInkStrings { saveFailedTitle: string; saveFailedMessage: string; keepEditing: string; discard: string }
  export interface PdfInkPlugin {
    isAvailable(): Promise<{ available: boolean }>;
    open(o: { pdfPath: string; inkPath: string; title: string; strings: PdfInkStrings }): Promise<{ hasInk: boolean }>;
  }
  export interface OpenPdfWithInkDeps { plugin: Pick<PdfInkPlugin, 'open'>; fs: PdfCacheFs; inkUri(key: string): Promise<string>; now(): number }
  export interface OpenPdfWithInkInput { courseCode: string; fileLink: string; name: string; date: string; strings: PdfInkStrings; fetchPdf(): Promise<Blob | null> }
  export type OpenPdfWithInkResult =
    | { kind: 'shown'; hasInk: boolean }
    | { kind: 'unreadable'; blob: Blob }
    | { kind: 'notPdf' }
    | { kind: 'failed'; error: unknown };
  export function pdfInkKey(courseCode: string, fileLink: string): Promise<string>;
  export function openPdfWithInk(deps: OpenPdfWithInkDeps, input: OpenPdfWithInkInput): Promise<OpenPdfWithInkResult>;
  ```

- [ ] **Step 1: Write the failing tests**

`src/mobile/__tests__/pdfInk.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { memFs } from './memPdfCacheFs';
import { pdfPath, readIndex, store } from '../pdfCache';
import {
  openPdfWithInk,
  pdfInkKey,
  type OpenPdfWithInkDeps,
  type OpenPdfWithInkInput,
  type PdfInkStrings,
} from '../pdfInk';

vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

const STRINGS: PdfInkStrings = {
  saveFailedTitle: 't',
  saveFailedMessage: 'm',
  keepEditing: 'k',
  discard: 'd',
};
const LINK = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=359057;id=1';
const pdf = () => new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' });

function harness(over: Partial<OpenPdfWithInkDeps> = {}) {
  const { fs, files } = memFs();
  const open = vi.fn(async () => ({ hasInk: true }));
  const deps: OpenPdfWithInkDeps = {
    plugin: { open },
    fs,
    inkUri: async (key) => `file:///lib-cloud/pdf-ink/${key}.ink`,
    now: () => 5000,
    ...over,
  };
  const fetchPdf = vi.fn(async (): Promise<Blob | null> => pdf());
  const input: OpenPdfWithInkInput = {
    courseCode: 'EBC-MT',
    fileLink: LINK,
    name: 'Přednáška 09',
    date: '12. 3. 2026',
    strings: STRINGS,
    fetchPdf,
  };
  return { deps, input, open, fetchPdf, fs, files };
}

describe('pdfInkKey', () => {
  it('is the sha256 hex of courseCode:fileLink, the same identity the study notes use', async () => {
    const key = await pdfInkKey('EBC-MT', LINK);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(await pdfInkKey('EBC-MT', LINK)).toBe(key);
    expect(await pdfInkKey('EBC-XY', LINK)).not.toBe(key);
  });
});

describe('openPdfWithInk', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches, stores and opens when nothing is cached', async () => {
    const { deps, input, open, fetchPdf, fs } = harness();
    const key = await pdfInkKey(input.courseCode, input.fileLink);

    const result = await openPdfWithInk(deps, input);

    expect(result).toEqual({ kind: 'shown', hasInk: true });
    expect(fetchPdf).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith({
      pdfPath: `file:///lib/${pdfPath(key)}`,
      inkPath: `file:///lib-cloud/pdf-ink/${key}.ink`,
      title: 'Přednáška 09',
      strings: STRINGS,
    });
    expect((await readIndex(fs))[key]).toMatchObject({
      date: '12. 3. 2026',
      name: 'Přednáška 09',
      lastOpenedAt: 5000,
    });
  });

  it('opens a fresh copy without touching the network', async () => {
    const { deps, input, open, fetchPdf, fs } = harness({ now: () => 9000 });
    const key = await pdfInkKey(input.courseCode, input.fileLink);
    await store(fs, key, pdf(), { date: input.date, name: input.name }, 1000);

    await openPdfWithInk(deps, input);

    expect(fetchPdf).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
    expect((await readIndex(fs))[key]?.lastOpenedAt).toBe(9000);
  });

  it('refetches once when the IS document date changed', async () => {
    const { deps, input, fetchPdf, fs } = harness();
    const key = await pdfInkKey(input.courseCode, input.fileLink);
    await store(fs, key, pdf(), { date: 'old date', name: input.name }, 1000);

    await openPdfWithInk(deps, input);

    expect(fetchPdf).toHaveBeenCalledTimes(1);
    expect((await readIndex(fs))[key]?.date).toBe('12. 3. 2026');
  });

  it('opens the stale copy when IS is unreachable', async () => {
    const { deps, input, open, fetchPdf, fs } = harness();
    const key = await pdfInkKey(input.courseCode, input.fileLink);
    await store(fs, key, pdf(), { date: 'old date', name: input.name }, 1000);
    fetchPdf.mockRejectedValueOnce(new Error('offline'));

    const result = await openPdfWithInk(deps, input);

    expect(result.kind).toBe('shown');
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('fails without opening when nothing is cached and the fetch throws', async () => {
    const { deps, input, open, fetchPdf } = harness();
    fetchPdf.mockRejectedValueOnce(new Error('offline'));

    const result = await openPdfWithInk(deps, input);

    expect(result.kind).toBe('failed');
    expect(open).not.toHaveBeenCalled();
  });

  it('reports notPdf when IS served a viewer page and nothing is cached', async () => {
    const { deps, input, open, fetchPdf } = harness();
    fetchPdf.mockResolvedValueOnce(null);

    expect(await openPdfWithInk(deps, input)).toEqual({ kind: 'notPdf' });
    expect(open).not.toHaveBeenCalled();
  });

  it('hands the same bytes back for the web viewer when PDFKit cannot read them, and forgets the copy', async () => {
    const { deps, input, open, fetchPdf, fs, files } = harness();
    const key = await pdfInkKey(input.courseCode, input.fileLink);
    open.mockRejectedValueOnce(Object.assign(new Error('bad pdf'), { code: 'unreadable' }));

    const result = await openPdfWithInk(deps, input);

    expect(result.kind).toBe('unreadable');
    expect(fetchPdf).toHaveBeenCalledTimes(1);
    expect(files.has(pdfPath(key))).toBe(false);
    expect(await readIndex(fs)).toEqual({});
  });

  it('refetches for the web viewer when a FRESH copy turns out unreadable', async () => {
    const { deps, input, open, fetchPdf, fs } = harness();
    const key = await pdfInkKey(input.courseCode, input.fileLink);
    await store(fs, key, pdf(), { date: input.date, name: input.name }, 1000);
    open.mockRejectedValueOnce(Object.assign(new Error('bad pdf'), { code: 'unreadable' }));

    const result = await openPdfWithInk(deps, input);

    expect(result.kind).toBe('unreadable');
    expect(fetchPdf).toHaveBeenCalledTimes(1);
  });

  it('reports any other plugin rejection as failed', async () => {
    const { deps, input, open } = harness();
    open.mockRejectedValueOnce(new Error('no view controller'));
    expect((await openPdfWithInk(deps, input)).kind).toBe('failed');
  });

  it('enforces the cache cap after a successful open', async () => {
    const { deps, input, files } = harness();
    files.set('pdf-ink/orphan.pdf', { size: 301 * 1024 * 1024 });

    await openPdfWithInk(deps, input);

    expect(files.has('pdf-ink/orphan.pdf')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/mobile/__tests__/pdfInk.test.ts 2>&1 | tail -5
```

Expected: FAIL — `Failed to resolve import "../pdfInk"`.

- [ ] **Step 3: Implement `pdfInk.ts`**

```ts
import { logError } from '../utils/reportError';
import {
  enforceCap,
  forget,
  pdfPath,
  recordOpen,
  resolve,
  store,
  type PdfCacheFs,
} from './pdfCache';

/**
 * The JS half of the `PdfInk` plugin (native/capacitor-pdf-ink): types, the
 * cache key, and the one sequence that opens a subject PDF in the native
 * PencilKit reader. Pure — every side effect comes in through `deps`, so the
 * whole decision tree is unit-tested; pdfInkNative.ts wires the real plugin and
 * Capacitor's Filesystem.
 */

/** Alert copy for a failed save, translated by the app (mobile.pdfInk.*). */
export interface PdfInkStrings {
  saveFailedTitle: string;
  saveFailedMessage: string;
  keepEditing: string;
  discard: string;
}

export interface PdfInkPlugin {
  /** True only on an iPad running iPadOS 16 or newer. */
  isAvailable(): Promise<{ available: boolean }>;
  /** Presents the reader; resolves on Done. Rejects with `code: 'unreadable'` if PDFKit cannot open the file. */
  open(o: {
    pdfPath: string;
    inkPath: string;
    title: string;
    strings: PdfInkStrings;
  }): Promise<{ hasInk: boolean }>;
}

export interface OpenPdfWithInkDeps {
  plugin: Pick<PdfInkPlugin, 'open'>;
  fs: PdfCacheFs;
  /** file:// URI of the ink archive for a key (Library, backed up — ink is irreplaceable). */
  inkUri(key: string): Promise<string>;
  now(): number;
}

export interface OpenPdfWithInkInput {
  courseCode: string;
  fileLink: string;
  name: string;
  /** IS's document date from the file listing; '' when unknown (then no copy is ever fresh). */
  date: string;
  strings: PdfInkStrings;
  /** null means IS served a viewer page, not a PDF. */
  fetchPdf(): Promise<Blob | null>;
}

export type OpenPdfWithInkResult =
  | { kind: 'shown'; hasInk: boolean }
  /** PDFKit rejected the bytes; show them in the web viewer instead. */
  | { kind: 'unreadable'; blob: Blob }
  | { kind: 'notPdf' }
  | { kind: 'failed'; error: unknown };

/** Same identity string as the study notes (`courseCode:fileLink`), hashed because a URL is not a filename. */
export async function pdfInkKey(courseCode: string, fileLink: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${courseCode}:${fileLink}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function isUnreadable(e: unknown): boolean {
  return (e as { code?: unknown } | null)?.code === 'unreadable';
}

export async function openPdfWithInk(
  deps: OpenPdfWithInkDeps,
  input: OpenPdfWithInkInput
): Promise<OpenPdfWithInkResult> {
  const key = await pdfInkKey(input.courseCode, input.fileLink);
  const state = await resolve(deps.fs, key, input.date);

  let blob: Blob | null = null;
  if (state !== 'fresh') {
    try {
      blob = await input.fetchPdf();
    } catch (error) {
      if (state === 'absent') return { kind: 'failed', error };
      // Stale-if-error: IS is unreachable, but the student has a copy.
      logError('PdfInk.staleIfError', error);
    }
    if (blob) {
      await store(deps.fs, key, blob, { date: input.date, name: input.name }, deps.now());
    } else if (state === 'absent') {
      return { kind: 'notPdf' };
    }
  }

  try {
    const { hasInk } = await deps.plugin.open({
      pdfPath: await deps.fs.uri(pdfPath(key)),
      inkPath: await deps.inkUri(key),
      title: input.name,
      strings: input.strings,
    });
    await recordOpen(deps.fs, key, deps.now());
    await enforceCap(deps.fs);
    return { kind: 'shown', hasInk };
  } catch (error) {
    if (!isUnreadable(error)) return { kind: 'failed', error };
    // Bad bytes: drop the copy so the next open fetches afresh, and give the
    // web viewer the same blob when we still hold it (only a fresh copy that
    // went bad needs a second fetch).
    logError('PdfInk.unreadable', error);
    await forget(deps.fs, key);
    const fallback = blob ?? (await input.fetchPdf().catch(() => null));
    return fallback ? { kind: 'unreadable', blob: fallback } : { kind: 'failed', error };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/mobile/__tests__/pdfInk.test.ts src/mobile/__tests__/pdfCache.test.ts 2>&1 | tail -5
```

Expected: `Tests  23 passed` (11 new + 12 from Task 3).

- [ ] **Step 5: Commit**

```bash
git add src/mobile/pdfInk.ts src/mobile/__tests__/pdfInk.test.ts
git commit -m "feat(pdf-ink): fetch → cache → open sequence with typed fallbacks

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: `pdfInkNative.ts`, the guard allowance, and the alert strings

**Files:**
- Create: `src/mobile/pdfInkNative.ts`
- Test: `src/mobile/__tests__/pdfInkNative.test.ts`
- Modify: `src/test/guards/nativePluginsAreReachable.test.ts` (add `IOS_ONLY`)
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/cs.json` (`mobile.pdfInk`)

**Interfaces:**
- Consumes: `PdfInkPlugin`, `OpenPdfWithInkDeps` from Task 4; `PdfCacheFs`, `PDF_CACHE_DIR` from Task 3; `getPlatform()` from `src/platform/index.ts` (`kind: 'extension' | 'capacitor' | 'web'`).
- Produces:
  ```ts
  export function isPdfInkAvailable(): Promise<boolean>;          // memoised per session
  export function __resetPdfInkAvailabilityForTests(): void;
  export const capacitorPdfCacheFs: PdfCacheFs;                    // LibraryNoCloud
  export const nativePdfInkDeps: OpenPdfWithInkDeps;               // real plugin + fs; inkUri under Library
  ```

- [ ] **Step 1: Write the failing tests**

`src/mobile/__tests__/pdfInkNative.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted above every `const`, so anything a factory reads at
// factory time must be hoisted with it — otherwise "Cannot access before
// initialization" (see the note in useFileActions.test.ts).
const { plugin, Filesystem } = vi.hoisted(() => ({
  plugin: { isAvailable: vi.fn(), open: vi.fn() },
  Filesystem: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    stat: vi.fn(),
    readdir: vi.fn(),
    deleteFile: vi.fn(),
    getUri: vi.fn(),
  },
}));
vi.mock('@capacitor/core', () => ({
  registerPlugin: vi.fn(() => plugin),
  Capacitor: { getPlatform: vi.fn(() => 'web') },
}));
vi.mock('../../platform', () => ({
  getPlatform: vi.fn(() => ({ kind: 'web' })),
}));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem,
  Directory: { Library: 'LIBRARY', LibraryNoCloud: 'LIBRARY_NO_CLOUD' },
  Encoding: { UTF8: 'utf8' },
}));

import { Capacitor } from '@capacitor/core';
import { getPlatform } from '../../platform';
import {
  __resetPdfInkAvailabilityForTests,
  capacitorPdfCacheFs,
  isPdfInkAvailable,
  nativePdfInkDeps,
} from '../pdfInkNative';

function host(kind: 'extension' | 'capacitor' | 'web', os: 'ios' | 'android' | 'web' = 'web') {
  vi.mocked(getPlatform).mockReturnValue({ kind } as never);
  vi.mocked(Capacitor.getPlatform).mockReturnValue(os);
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetPdfInkAvailabilityForTests();
});

describe('isPdfInkAvailable', () => {
  it('is false in a browser and never asks the plugin', async () => {
    host('web');
    expect(await isPdfInkAvailable()).toBe(false);
    expect(plugin.isAvailable).not.toHaveBeenCalled();
  });

  it('is false on Android without asking the plugin — there is no Android half', async () => {
    host('capacitor', 'android');
    expect(await isPdfInkAvailable()).toBe(false);
    expect(plugin.isAvailable).not.toHaveBeenCalled();
  });

  it('is whatever the iOS plugin answers (iPad + iPadOS 16 is decided natively)', async () => {
    host('capacitor', 'ios');
    plugin.isAvailable.mockResolvedValue({ available: true });
    expect(await isPdfInkAvailable()).toBe(true);
    __resetPdfInkAvailabilityForTests();
    plugin.isAvailable.mockResolvedValue({ available: false });
    expect(await isPdfInkAvailable()).toBe(false);
  });

  it('is false when the plugin rejects (not registered)', async () => {
    host('capacitor', 'ios');
    plugin.isAvailable.mockRejectedValue(new Error('"PdfInk" plugin is not implemented on ios'));
    expect(await isPdfInkAvailable()).toBe(false);
  });

  it('asks once per session', async () => {
    host('capacitor', 'ios');
    plugin.isAvailable.mockResolvedValue({ available: true });
    await isPdfInkAvailable();
    await isPdfInkAvailable();
    expect(plugin.isAvailable).toHaveBeenCalledTimes(1);
  });
});

describe('capacitorPdfCacheFs', () => {
  it('reads text from the no-cloud Library and maps a missing file to null', async () => {
    Filesystem.readFile.mockResolvedValueOnce({ data: '{"a":1}' });
    expect(await capacitorPdfCacheFs.readText('pdf-ink/index.json')).toBe('{"a":1}');
    expect(Filesystem.readFile).toHaveBeenCalledWith({
      path: 'pdf-ink/index.json',
      directory: 'LIBRARY_NO_CLOUD',
      encoding: 'utf8',
    });
    Filesystem.readFile.mockRejectedValueOnce(new Error('File does not exist'));
    expect(await capacitorPdfCacheFs.readText('pdf-ink/index.json')).toBeNull();
  });

  it('writes base64 bytes with parent directories', async () => {
    await capacitorPdfCacheFs.writeBase64('pdf-ink/k.pdf', 'QUJD');
    expect(Filesystem.writeFile).toHaveBeenCalledWith({
      path: 'pdf-ink/k.pdf',
      data: 'QUJD',
      directory: 'LIBRARY_NO_CLOUD',
      recursive: true,
    });
  });

  it('answers exists from stat, and lists only files with their sizes', async () => {
    Filesystem.stat.mockRejectedValueOnce(new Error('missing'));
    expect(await capacitorPdfCacheFs.exists('pdf-ink/k.pdf')).toBe(false);
    Filesystem.stat.mockResolvedValueOnce({ type: 'file' });
    expect(await capacitorPdfCacheFs.exists('pdf-ink/k.pdf')).toBe(true);

    Filesystem.readdir.mockResolvedValueOnce({
      files: [
        { name: 'a.pdf', type: 'file', size: 10 },
        { name: 'sub', type: 'directory', size: 0 },
      ],
    });
    expect(await capacitorPdfCacheFs.list('pdf-ink')).toEqual([{ name: 'a.pdf', size: 10 }]);
    Filesystem.readdir.mockRejectedValueOnce(new Error('missing'));
    expect(await capacitorPdfCacheFs.list('pdf-ink')).toEqual([]);
  });

  it('puts PDFs in the no-cloud Library and ink in the backed-up Library', async () => {
    Filesystem.getUri.mockResolvedValue({ uri: 'file:///x' });
    await capacitorPdfCacheFs.uri('pdf-ink/k.pdf');
    expect(Filesystem.getUri).toHaveBeenLastCalledWith({
      path: 'pdf-ink/k.pdf',
      directory: 'LIBRARY_NO_CLOUD',
    });
    await nativePdfInkDeps.inkUri('k');
    expect(Filesystem.getUri).toHaveBeenLastCalledWith({
      path: 'pdf-ink/k.ink',
      directory: 'LIBRARY',
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/mobile/__tests__/pdfInkNative.test.ts 2>&1 | tail -5
```

Expected: FAIL — `Failed to resolve import "../pdfInkNative"`.

- [ ] **Step 3: Implement `pdfInkNative.ts`**

```ts
import { Capacitor, registerPlugin } from '@capacitor/core';
import { getPlatform } from '../platform';
import { PDF_CACHE_DIR, type PdfCacheFs } from './pdfCache';
import type { OpenPdfWithInkDeps, PdfInkPlugin } from './pdfInk';

/**
 * The real wiring for pdfInk.ts: the registered plugin and Capacitor's
 * Filesystem. Pattern: eduroamNative.ts. Kept apart from the sequencing so that
 * file stays pure and this one stays thin.
 */
const PdfInk = registerPlugin<PdfInkPlugin>('PdfInk');

let availability: Promise<boolean> | null = null;

/**
 * Can this device show the native reader? Decided once per session. The iPad /
 * iPadOS 16 test is the plugin's, never a user-agent or viewport guess (a
 * WKWebView can call itself a Macintosh). Android is answered here without a
 * call: there is no Android half, by design.
 */
export function isPdfInkAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      if (getPlatform().kind !== 'capacitor' || Capacitor.getPlatform() !== 'ios') return false;
      try {
        return (await PdfInk.isAvailable()).available;
      } catch {
        return false;
      }
    })();
  }
  return availability;
}

export function __resetPdfInkAvailabilityForTests(): void {
  availability = null;
}

// Loaded lazily like openIsFile.ts does: the module is only ever needed on the
// native path, and the web build should not pay for it.
async function fsModule() {
  return import('@capacitor/filesystem');
}

/** PDF bytes and the index: LibraryNoCloud — refetchable, so kept out of the device backup. */
export const capacitorPdfCacheFs: PdfCacheFs = {
  async readText(path) {
    const { Filesystem, Directory, Encoding } = await fsModule();
    try {
      const { data } = await Filesystem.readFile({
        path,
        directory: Directory.LibraryNoCloud,
        encoding: Encoding.UTF8,
      });
      return typeof data === 'string' ? data : null;
    } catch {
      return null;
    }
  },
  async writeText(path, text) {
    const { Filesystem, Directory, Encoding } = await fsModule();
    await Filesystem.writeFile({
      path,
      data: text,
      directory: Directory.LibraryNoCloud,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  },
  async writeBase64(path, base64) {
    const { Filesystem, Directory } = await fsModule();
    await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.LibraryNoCloud,
      recursive: true,
    });
  },
  async exists(path) {
    const { Filesystem, Directory } = await fsModule();
    try {
      await Filesystem.stat({ path, directory: Directory.LibraryNoCloud });
      return true;
    } catch {
      return false;
    }
  },
  async list(dir) {
    const { Filesystem, Directory } = await fsModule();
    try {
      const { files } = await Filesystem.readdir({ path: dir, directory: Directory.LibraryNoCloud });
      return files.filter((f) => f.type === 'file').map((f) => ({ name: f.name, size: f.size }));
    } catch {
      return [];
    }
  },
  async remove(path) {
    const { Filesystem, Directory } = await fsModule();
    await Filesystem.deleteFile({ path, directory: Directory.LibraryNoCloud });
  },
  async uri(path) {
    const { Filesystem, Directory } = await fsModule();
    return (await Filesystem.getUri({ path, directory: Directory.LibraryNoCloud })).uri;
  },
};

export const nativePdfInkDeps: OpenPdfWithInkDeps = {
  plugin: PdfInk,
  fs: capacitorPdfCacheFs,
  // Ink is irreplaceable, so it lives in Library and rides along in the device backup.
  inkUri: async (key) => {
    const { Filesystem, Directory } = await fsModule();
    return (
      await Filesystem.getUri({ path: `${PDF_CACHE_DIR}/${key}.ink`, directory: Directory.Library })
    ).uri;
  },
  now: () => Date.now(),
};
```

- [ ] **Step 4: Run the new tests, then the plugin guard, to see the guard fail**

```bash
npx vitest run src/mobile/__tests__/pdfInkNative.test.ts 2>&1 | tail -5
```

Expected: `Tests  9 passed`.

```bash
npx vitest run src/test/guards/nativePluginsAreReachable.test.ts 2>&1 | grep -E "✓|✗|×|FAIL|passed|failed" | head
```

Expected: one failure, `ships an Android half for every registered plugin too`, listing `PdfInk`. (The iOS check passes because Task 1 packaged `@objc(PdfInkPlugin)`.)

- [ ] **Step 5: Add the `IOS_ONLY` allowance to the guard**

In `src/test/guards/nativePluginsAreReachable.test.ts`, directly after the `ANDROID_ONLY` constant, add:

```ts
/**
 * The mirror of ANDROID_ONLY: plugins whose Android half does not exist because
 * the feature is iPad-only IN FACT, with the reason. JS must gate every call on
 * `Capacitor.getPlatform() === 'ios'` (src/mobile/pdfInkNative.ts does), so on
 * Android the plugin is never even asked.
 */
const IOS_ONLY: Record<string, string> = {
  // native/capacitor-pdf-ink: PDFKit + PencilKit reader. Android keeps the
  // pdf.js viewer; there is no PencilKit to reuse there.
  PdfInk: 'iPad-only PencilKit reader — Android keeps the pdf.js viewer',
};
```

Then change the last test's `missing` computation to:

```ts
    const missing = registeredNames().filter(
      (name) => !java.includes(`${name}Plugin.java`) && !(name in IOS_ONLY)
    );
```

And add, after the `keeps the Android-only list honest` test, its mirror:

```ts
  it('keeps the iOS-only list honest', () => {
    const javaDir = join(root, 'android/app/src/main/java/cz/reis/app');
    const java = existsSync(javaDir) ? readdirSync(javaDir).join('\n') : '';
    const stale = Object.keys(IOS_ONLY).filter((name) => java.includes(`${name}Plugin.java`));
    expect(stale, `These now have an Android class and should leave IOS_ONLY`).toEqual([]);
  });
```

- [ ] **Step 6: Run the guard to verify it passes**

```bash
npx vitest run src/test/guards/nativePluginsAreReachable.test.ts 2>&1 | tail -5
```

Expected: `Tests  6 passed`.

- [ ] **Step 7: Add the alert strings to both locales**

```bash
node -e '
const fs = require("fs");
const add = {
  "src/i18n/locales/en.json": {
    saveFailedTitle: "Your ink couldn't be saved",
    saveFailedMessage: "There may be no space left on this iPad. Keep editing and try again, or discard the changes.",
    keepEditing: "Keep editing",
    discard: "Discard"
  },
  "src/i18n/locales/cs.json": {
    saveFailedTitle: "Poznámky se nepodařilo uložit",
    saveFailedMessage: "Na iPadu možná není místo. Pokračujte v úpravách a zkuste to znovu, nebo změny zahoďte.",
    keepEditing: "Pokračovat v úpravách",
    discard: "Zahodit"
  }
};
for (const [file, strings] of Object.entries(add)) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  json.mobile.pdfInk = strings;
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
}
'
git diff --stat src/i18n/locales/
```

Expected: each file shows roughly `+7 -1` lines. If the diff is hundreds of lines the file's formatting differed; revert with `git checkout src/i18n/locales/` and add the `"pdfInk": { … }` object by hand inside `"mobile": {`, next to `"sheet"`.

```bash
npx vitest run src/i18n/__tests__/mobileKeys.test.ts 2>&1 | tail -3
```

Expected: `Tests  3 passed`.

- [ ] **Step 8: Commit**

```bash
git add src/mobile/pdfInkNative.ts src/mobile/__tests__/pdfInkNative.test.ts src/test/guards/nativePluginsAreReachable.test.ts src/i18n/locales/en.json src/i18n/locales/cs.json
git commit -m "feat(pdf-ink): register the PdfInk plugin, Filesystem adapter, iOS-only guard allowance, alert copy

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: `useFileActions.fetchPdfBlob` — one fetch, two consumers

**Files:**
- Modify: `src/hooks/ui/useFileActions.ts:36-43` (interface), `:95-123` (`openPdfInline`)
- Test: `src/hooks/ui/useFileActions.test.ts`

**Interfaces:**
- Produces: `fetchPdfBlob: (link: string) => Promise<Blob | null>` on the `useFileActions()` result. `openPdfInline` keeps its signature and becomes `fetchPdfBlob` + `URL.createObjectURL`.

- [ ] **Step 1: Write the failing tests**

Append to the `describe('useFileActions', …)` block in `src/hooks/ui/useFileActions.test.ts`:

```ts
    describe('fetchPdfBlob / openPdfInline', () => {
        it('fetchPdfBlob returns the bytes with credentials, null when IS refuses', async () => {
            const { result } = renderHook(() => useFileActions());
            const blob = await result.current.fetchPdfBlob('https://is.mendelu.cz/x.pdf');
            expect(blob).toBeInstanceOf(Blob);
            expect(global.fetch).toHaveBeenCalledWith('https://is.mendelu.cz/x.pdf', { credentials: 'include' });

            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });
            expect(await result.current.fetchPdfBlob('https://is.mendelu.cz/x.pdf')).toBeNull();
        });

        it('openPdfInline is fetchPdfBlob plus a blob URL', async () => {
            URL.createObjectURL = vi.fn(() => 'blob:one');
            const { result } = renderHook(() => useFileActions());
            expect(await result.current.openPdfInline('https://is.mendelu.cz/x.pdf')).toBe('blob:one');
            expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));

            (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });
            expect(await result.current.openPdfInline('https://is.mendelu.cz/x.pdf')).toBeNull();
        });
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/hooks/ui/useFileActions.test.ts 2>&1 | grep -E "✓|×|FAIL|passed|failed" | tail -6
```

Expected: the two new tests fail (`result.current.fetchPdfBlob is not a function`); the rest pass.

- [ ] **Step 3: Split the fetch out of `openPdfInline`**

In `src/hooks/ui/useFileActions.ts`, add to `UseFileActionsResult`:

```ts
  /** The bytes of an IS PDF, or null when IS served a viewer page instead. */
  fetchPdfBlob: (link: string) => Promise<Blob | null>;
```

Replace the whole `openPdfInline` `useCallback` with:

```ts
  const fetchPdfBlob = useCallback(async (link: string): Promise<Blob | null> => {
    const fullUrl = normalizeFileUrl(link);
    try {
      // Capacitor: fetch natively — no window.open, so no escape to Chrome.
      if (isNativeHost()) {
        const { fetchIsBinary } = await import('../../api/capacitorBinary');
        const { loadStoredToken } = await import('../../platform/tokenStore');
        const { Capacitor, CapacitorHttp, CapacitorCookies } = await import('@capacitor/core');
        const result = await fetchIsBinary(fullUrl, await loadStoredToken(), {
          platform: Capacitor.getPlatform() as 'ios' | 'android' | 'web',
          setCookie: (o) => CapacitorCookies.setCookie(o),
          httpGet: (o) => CapacitorHttp.get(o),
        });
        // A viewer page is not a PDF — null lets the caller fall back to its
        // normal "can't preview" path.
        return result.kind === 'binary' ? result.blob : null;
      }
      assertNotDemo();
      const response = await fetch(fullUrl, { credentials: 'include' });
      if (!response.ok) return null;
      return await response.blob();
    } catch (e) {
      log.error('Failed to fetch PDF inline', e);
      return null;
    }
  }, []);

  // The web viewer's input. The iPad reader (usePdfPreview → openPdfWithInk)
  // takes fetchPdfBlob directly, so both consume ONE fetch and a fallback from
  // one to the other never refetches.
  const openPdfInline = useCallback(
    async (link: string): Promise<string | null> => {
      const blob = await fetchPdfBlob(link);
      return blob ? URL.createObjectURL(blob) : null;
    },
    [fetchPdfBlob]
  );
```

And add `fetchPdfBlob` to the returned object:

```ts
  return { isDownloading, downloadProgress, openFile, fetchPdfBlob, openPdfInline, downloadSingle, downloadZip };
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/hooks/ui/useFileActions.test.ts 2>&1 | tail -4
```

Expected: all tests pass, including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/ui/useFileActions.ts src/hooks/ui/useFileActions.test.ts
git commit -m "refactor(files): split fetchPdfBlob out of openPdfInline so two readers share one fetch

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: `onViewPdf(link, meta)` carries the row's name and IS document date

**Files:**
- Modify: `src/components/SubjectFileDrawer/types.ts:39` (FileListProps.onViewPdf)
- Modify: `src/components/SubjectFileDrawer/FileListItem.tsx:32,66,156`
- Modify: `src/components/SubjectFileDrawer/DrawerTabBody.tsx:32`
- Modify: `src/components/SubjectFileDrawer/SubjectFileDrawerContent.tsx:23`
- Test: `src/components/SubjectFileDrawer/__tests__/FileList.test.tsx`

**Interfaces:**
- Produces: `export interface PdfRowMeta { name: string; date: string }` in `types.ts`; every `onViewPdf` prop becomes `(link: string, meta: PdfRowMeta) => void`. Existing callers that take only `link` (desktop `handleViewPdf`, `usePdfPreview.viewPdf`) remain assignable.

- [ ] **Step 1: Write the failing test**

Add to `src/components/SubjectFileDrawer/__tests__/FileList.test.tsx` inside `describe('FileList', …)`:

```ts
  it('hands the row name and IS document date along with a PDF link — the iPad reader caches by date', async () => {
    const onViewPdf = vi.fn();
    renderList({ onViewPdf });
    await userEvent.click(screen.getByText('Přednáška 09'));
    expect(onViewPdf).toHaveBeenCalledWith(DOWNLOAD, { name: 'Přednáška 09', date: '12. 3. 2026' });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/components/SubjectFileDrawer/__tests__/FileList.test.tsx 2>&1 | grep -E "×|✓|passed|failed" | tail -4
```

Expected: the new test fails — called with `DOWNLOAD` only.

- [ ] **Step 3: Thread the meta through the four files**

`src/components/SubjectFileDrawer/types.ts` — add above `FileListProps` and change its `onViewPdf`:

```ts
/** What a PDF row knows that the iPad reader needs: the display name and IS's document date. */
export interface PdfRowMeta {
  name: string;
  date: string;
}
```

```ts
  onViewPdf?: (link: string, meta: PdfRowMeta) => void;
```

`src/components/SubjectFileDrawer/FileListItem.tsx` — import the type and change the prop and both calls:

```ts
import type { PdfRowMeta } from './types';
```

```ts
  onViewPdf?: (link: string, meta: PdfRowMeta) => void;
```

Line 66 (inside `activate`) and line 156 (the eye/open button) both become:

```ts
      onViewPdf(subFile.link, { name: displayName, date });
```

`src/components/SubjectFileDrawer/DrawerTabBody.tsx:32` and `src/components/SubjectFileDrawer/SubjectFileDrawerContent.tsx:23`:

```ts
  onViewPdf?: (link: string, meta: PdfRowMeta) => void;
```

with `import type { PdfRowMeta } from './types';` added to each (merge into the existing `./types` import if one exists).

- [ ] **Step 4: Run the test and the typecheck**

```bash
npx vitest run src/components/SubjectFileDrawer 2>&1 | tail -4 && npm run typecheck 2>&1 | tail -3
```

Expected: all SubjectFileDrawer tests pass; `tsc -b` prints nothing (exit 0). The desktop `handleViewPdf(link)` still type-checks because a callback with fewer parameters is assignable.

- [ ] **Step 5: Commit**

```bash
git add src/components/SubjectFileDrawer
git commit -m "feat(files): PDF rows pass their name and IS document date to onViewPdf

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: `usePdfPreview` branches to the native reader; the sheet passes the course

**Files:**
- Modify: `src/hooks/ui/usePdfPreview.ts`
- Modify: `src/components/mobile/sheets/SubjectDrawerSheet.tsx:72`
- Test: `src/hooks/ui/__tests__/usePdfPreview.test.tsx`

**Interfaces:**
- Consumes: `isPdfInkAvailable`, `nativePdfInkDeps` (Task 5); `openPdfWithInk`, `PdfInkStrings` (Task 4); `fetchPdfBlob` (Task 6); `PdfRowMeta` shape from Task 7 (name, date).
- Produces: `usePdfPreview(courseCode?: string)`; `viewPdf(link: string, meta?: { name?: string; date?: string })`. Everything else on the hook's result is unchanged.

- [ ] **Step 1: Rewrite the test file with the new contract**

Replace `src/hooks/ui/__tests__/usePdfPreview.test.tsx` entirely:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const openPdfInline = vi.fn();
const fetchPdfBlob = vi.fn();
const openFile = vi.fn();
vi.mock('../useFileActions', () => ({
  useFileActions: () => ({
    openPdfInline: (...a: unknown[]) => openPdfInline(...a),
    fetchPdfBlob: (...a: unknown[]) => fetchPdfBlob(...a),
    openFile: (...a: unknown[]) => openFile(...a),
    downloadSingle: vi.fn(),
    isDownloading: false,
    downloadProgress: null,
  }),
}));

const isPdfInkAvailable = vi.fn(async () => false);
vi.mock('../../../mobile/pdfInkNative', () => ({
  isPdfInkAvailable: () => isPdfInkAvailable(),
  nativePdfInkDeps: { tag: 'native-deps' },
}));

const openPdfWithInk = vi.fn();
vi.mock('../../../mobile/pdfInk', () => ({
  openPdfWithInk: (...a: unknown[]) => openPdfWithInk(...a),
}));

// Read at factory time, so it must be hoisted with vi.mock.
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { usePdfPreview } from '../usePdfPreview';

describe('usePdfPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPdfInkAvailable.mockResolvedValue(false);
    URL.revokeObjectURL = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:from-ink');
  });

  it('shows the blob it fetched', async () => {
    openPdfInline.mockResolvedValue('blob:abc');
    const { result } = renderHook(() => usePdfPreview());
    await act(async () => void (await result.current.viewPdf('/x.pdf', { name: 'Notes' })));
    expect(result.current.previewUrl).toBe('blob:abc');
    expect(result.current.previewFile).toEqual({ link: '/x.pdf', name: 'Notes' });
  });

  // IS serves viewer pages under the same anchors, so "not a PDF" is a normal
  // outcome rather than an error — fall through to the download.
  it('falls back to the download when the file is not a PDF', async () => {
    openPdfInline.mockResolvedValue(null);
    const { result } = renderHook(() => usePdfPreview());
    await act(async () => void (await result.current.viewPdf('/x.html')));
    expect(openFile).toHaveBeenCalledWith('/x.html');
    expect(result.current.previewUrl).toBeNull();
  });

  it('revokes the blob when the preview is closed', async () => {
    openPdfInline.mockResolvedValue('blob:abc');
    const { result } = renderHook(() => usePdfPreview());
    await act(async () => void (await result.current.viewPdf('/x.pdf')));
    act(() => result.current.closePreview());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:abc');
  });

  // Close the drawer while the fetch is still running: the URL lands on a dead
  // hook, so it never reaches state and the unmount cleanup never sees it. Left
  // alone, the blob is pinned for the life of the document.
  it('revokes a blob that arrives after unmount', async () => {
    let resolveFetch!: (v: string) => void;
    openPdfInline.mockReturnValue(new Promise<string>((r) => (resolveFetch = r)));

    const { result, unmount } = renderHook(() => usePdfPreview());
    let pending!: Promise<void>;
    act(() => void (pending = result.current.viewPdf('/x.pdf')));

    unmount();
    await act(async () => {
      resolveFetch('blob:late');
      await pending;
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:late');
  });

  describe('on an iPad with the PdfInk plugin', () => {
    beforeEach(() => isPdfInkAvailable.mockResolvedValue(true));

    it('opens the native reader with the course, link, name and date, and mounts no web viewer', async () => {
      openPdfWithInk.mockResolvedValue({ kind: 'shown', hasInk: true });
      const { result } = renderHook(() => usePdfPreview('EBC-MT'));
      await act(
        async () =>
          void (await result.current.viewPdf('/x.pdf', { name: 'Slides', date: '12. 3. 2026' }))
      );
      expect(openPdfWithInk).toHaveBeenCalledWith(
        { tag: 'native-deps' },
        expect.objectContaining({
          courseCode: 'EBC-MT',
          fileLink: '/x.pdf',
          name: 'Slides',
          date: '12. 3. 2026',
          strings: expect.objectContaining({ discard: expect.any(String) }),
          fetchPdf: expect.any(Function),
        })
      );
      expect(openPdfInline).not.toHaveBeenCalled();
      expect(result.current.previewUrl).toBeNull();
      expect(result.current.isPreviewLoading).toBe(false);
    });

    it('hands its fetchPdf to the file actions so the reader and the viewer share one fetch', async () => {
      openPdfWithInk.mockResolvedValue({ kind: 'shown', hasInk: false });
      const { result } = renderHook(() => usePdfPreview('EBC-MT'));
      await act(async () => void (await result.current.viewPdf('/x.pdf', { date: 'd' })));
      const input = openPdfWithInk.mock.calls[0]?.[1] as { fetchPdf: () => Promise<Blob | null> };
      await input.fetchPdf();
      expect(fetchPdfBlob).toHaveBeenCalledWith('/x.pdf');
    });

    it('mounts the web viewer from the same bytes when PDFKit cannot read them', async () => {
      const blob = new Blob(['x']);
      openPdfWithInk.mockResolvedValue({ kind: 'unreadable', blob });
      const { result } = renderHook(() => usePdfPreview('EBC-MT'));
      await act(async () => void (await result.current.viewPdf('/x.pdf', { name: 'Slides' })));
      expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(result.current.previewUrl).toBe('blob:from-ink');
      expect(result.current.previewFile).toEqual({ link: '/x.pdf', name: 'Slides' });
    });

    it('falls back to the download when IS served a viewer page', async () => {
      openPdfWithInk.mockResolvedValue({ kind: 'notPdf' });
      const { result } = renderHook(() => usePdfPreview('EBC-MT'));
      await act(async () => void (await result.current.viewPdf('/x.html')));
      expect(openFile).toHaveBeenCalledWith('/x.html');
    });

    it('tells the student when the reader failed, instead of a tap that did nothing', async () => {
      openPdfWithInk.mockResolvedValue({ kind: 'failed', error: new Error('offline') });
      const { result } = renderHook(() => usePdfPreview('EBC-MT'));
      await act(async () => void (await result.current.viewPdf('/x.pdf')));
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(result.current.previewUrl).toBeNull();
      expect(result.current.isPreviewLoading).toBe(false);
    });

    it('uses the web viewer when no course is known — there is nothing to key the ink by', async () => {
      openPdfInline.mockResolvedValue('blob:abc');
      const { result } = renderHook(() => usePdfPreview());
      await act(async () => void (await result.current.viewPdf('/x.pdf')));
      expect(openPdfWithInk).not.toHaveBeenCalled();
      expect(result.current.previewUrl).toBe('blob:abc');
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

```bash
npx vitest run src/hooks/ui/__tests__/usePdfPreview.test.tsx 2>&1 | grep -E "×|✓|passed|failed" | tail -12
```

Expected: the four original tests pass; the six iPad tests fail (`openPdfWithInk` never called, etc.).

- [ ] **Step 3: Rewrite `usePdfPreview.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useFileActions } from './useFileActions';
import { useTranslation } from '../useTranslation';
import { logError } from '../../utils/reportError';
import { openPdfWithInk, type PdfInkStrings } from '../../mobile/pdfInk';
import { isPdfInkAvailable, nativePdfInkDeps } from '../../mobile/pdfInkNative';

export interface PdfPreviewFile {
  link: string;
  name: string;
}

/** What a file row passes along with the link; both are optional for callers that lack them. */
export interface PdfPreviewMeta {
  name?: string;
  date?: string;
}

/**
 * "Tap to look, press to save" for a file row.
 *
 * Two readers sit behind `viewPdf`:
 *
 * - On an iPad with the PdfInk plugin (native/capacitor-pdf-ink) and a known
 *   course, the PDF opens in the native PencilKit reader. Ink and the PDF bytes
 *   persist on the device; nothing here needs state while it is up, because it
 *   covers the whole screen. `courseCode` is what keys the ink and the cache, so
 *   without one the web viewer is used.
 * - Everywhere else — desktop, iPhone, Android, a PDF PDFKit rejects — the blob
 *   goes to the inline pdf.js viewer exactly as before. A fallback from the
 *   native path reuses the bytes it already fetched.
 *
 * A file that turns out not to be a real PDF (IS serves viewer pages under the
 * same anchors) falls back to the download rather than opening an empty viewer.
 */
export function usePdfPreview(courseCode?: string) {
  const {
    openFile,
    openPdfInline,
    fetchPdfBlob,
    downloadSingle,
    isDownloading,
    downloadProgress,
  } = useFileActions();
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<PdfPreviewFile | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Blob URLs are held by the document until revoked; a drawer opened and
  // closed a dozen times would otherwise pin every PDF it ever showed in memory.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // The cleanup above only ever sees a URL that reached state. Close the drawer
  // while the fetch is still running and the URL lands on a dead hook: no state
  // update, no cleanup, and the blob is pinned for the life of the document.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const inkStrings = useCallback(
    (): PdfInkStrings => ({
      saveFailedTitle: t('mobile.pdfInk.saveFailedTitle'),
      saveFailedMessage: t('mobile.pdfInk.saveFailedMessage'),
      keepEditing: t('mobile.pdfInk.keepEditing'),
      discard: t('mobile.pdfInk.discard'),
    }),
    [t]
  );

  /**
   * Native reader first. `handled` means the tap is done (shown, or failed and
   * told); `viewer` hands the web viewer a blob URL, or null to fall back to the
   * download (IS served a viewer page).
   */
  const tryNativeReader = useCallback(
    async (
      link: string,
      name: string,
      meta?: PdfPreviewMeta
    ): Promise<{ kind: 'handled' } | { kind: 'viewer'; blobUrl: string | null }> => {
      const result = await openPdfWithInk(nativePdfInkDeps, {
        courseCode: courseCode ?? '',
        fileLink: link,
        name,
        date: meta?.date ?? '',
        strings: inkStrings(),
        fetchPdf: () => fetchPdfBlob(link),
      });
      if (result.kind === 'shown') return { kind: 'handled' };
      if (result.kind === 'unreadable') {
        return { kind: 'viewer', blobUrl: URL.createObjectURL(result.blob) };
      }
      if (result.kind === 'failed') {
        logError('usePdfPreview.nativeReader', result.error);
        toast.error(t('course.file.openFailed'));
        return { kind: 'handled' };
      }
      return { kind: 'viewer', blobUrl: null };
    },
    [courseCode, inkStrings, fetchPdfBlob, t]
  );

  const viewPdf = useCallback(
    async (link: string, meta?: PdfPreviewMeta) => {
      if (isPreviewLoading) return;
      setIsPreviewLoading(true);
      const name = meta?.name ?? 'PDF';
      try {
        let blobUrl: string | null;
        if (courseCode && (await isPdfInkAvailable())) {
          const outcome = await tryNativeReader(link, name, meta);
          if (outcome.kind === 'handled') return;
          blobUrl = outcome.blobUrl;
        } else {
          blobUrl = await openPdfInline(link);
        }
        if (!alive.current) {
          // Nobody is left to show it to, and nobody is left to revoke it.
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          return;
        }
        if (blobUrl) {
          setPreviewUrl(blobUrl);
          setPreviewFile({ link, name });
        } else {
          await openFile(link);
        }
      } finally {
        if (alive.current) setIsPreviewLoading(false);
      }
    },
    [courseCode, tryNativeReader, openPdfInline, openFile, isPreviewLoading]
  );

  const closePreview = useCallback(() => {
    setPreviewUrl(null);
    setPreviewFile(null);
  }, []);

  return {
    previewUrl,
    previewFile,
    isPreviewLoading,
    viewPdf,
    closePreview,
    openFile,
    downloadSingle,
    isDownloading,
    downloadProgress,
  };
}
```

- [ ] **Step 4: Pass the course from the sheet**

In `src/components/mobile/sheets/SubjectDrawerSheet.tsx:72` change:

```ts
  const { previewUrl, viewPdf, closePreview, openFile, downloadSingle } = usePdfPreview();
```

to:

```ts
  // The course is what keys the iPad reader's ink and PDF cache (see usePdfPreview).
  const { previewUrl, viewPdf, closePreview, openFile, downloadSingle } = usePdfPreview(courseCode);
```

- [ ] **Step 5: Run the affected tests, typecheck and lint**

```bash
npx vitest run src/hooks/ui src/components/mobile/sheets src/components/SubjectFileDrawer src/mobile src/test/guards 2>&1 | tail -6 && npm run typecheck 2>&1 | tail -3 && npm run lint 2>&1 | tail -5
```

Expected: all tests pass (the sheet test still works: its `useFileActions` mock lacks `fetchPdfBlob`, but the test-environment platform is the extension host, so `isPdfInkAvailable()` is false and the native branch never runs); `tsc -b` silent; lint clean. `usePdfPreview.ts` must stay under 200 lines (`wc -l src/hooks/ui/usePdfPreview.ts`).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/ui/usePdfPreview.ts src/hooks/ui/__tests__/usePdfPreview.test.tsx src/components/mobile/sheets/SubjectDrawerSheet.tsx
git commit -m "feat(pdf-ink): subject PDFs open in the native PencilKit reader on iPad, web viewer as fallback

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Full verification, the device checklist, and the simulator smoke run

**Files:**
- Create: `docs/superpowers/specs/2026-09-06-ipad-pdf-ink-verification-checklist.md`

**Interfaces:** none new. This task proves the whole plan on the build the student would get.

- [ ] **Step 1: Run every automated gate**

```bash
npm run typecheck 2>&1 | tail -2 && npm run lint 2>&1 | tail -3 && npx vitest run 2>&1 | tail -6
```

Expected: `tsc -b` silent, lint clean, every test file passes. Then:

```bash
npm run check:app 2>&1 | tail -8
```

Expected: the app check passes — it boots the web build, which never reaches the plugin.

- [ ] **Step 2: Sync, build for an iPad simulator, and smoke the reader with a finger**

```bash
npm run cap:sync 2>&1 | grep -E "PdfInk|Found .* plugins|error"
xcrun simctl boot 32B6CB7C-756A-4803-AC49-292E1CA8D495 2>/dev/null; xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'id=32B6CB7C-756A-4803-AC49-292E1CA8D495' -derivedDataPath /tmp/reis-pdfink-dd build 2>&1 | grep -E "error:|BUILD" | tail -3
xcrun simctl install 32B6CB7C-756A-4803-AC49-292E1CA8D495 /tmp/reis-pdfink-dd/Build/Products/Debug-iphonesimulator/App.app && xcrun simctl launch 32B6CB7C-756A-4803-AC49-292E1CA8D495 cz.reis.app
```

Expected: `** BUILD SUCCEEDED **`, and the app launches to the IS login on the "iPad Air 11-inch (M4)" simulator. Open the live simulator panel (iOS Simulator MCP `attach`) and ask the developer to sign in there — credentials are theirs to type, never the agent's. Then open a subject, tap a PDF. The native reader appears with Apple's tool picker at the bottom; with no Pencil paired, a drag draws. Tap Done, reopen the PDF: the stroke is there. Drive the taps with the MCP `tap`/`swipe` actions and keep a `screenshot` as evidence. Capture the console for the plugin's own lines:

```bash
xcrun simctl spawn 32B6CB7C-756A-4803-AC49-292E1CA8D495 log stream --predicate 'process == "App" AND eventMessage CONTAINS "PdfInk"' 
```

Expected on erase-all-then-Done: `PdfInk: ink deleted for <key>.ink`.

- [ ] **Step 3: Write the device checklist**

`docs/superpowers/specs/2026-09-06-ipad-pdf-ink-verification-checklist.md`:

```markdown
# iPad PDF ink — device verification checklist

**Status: not yet run.** Fill in the device, iPadOS version and build, then tick each step
with what was observed. The simulator run (plan Task 9 Step 2) covers finger drawing only;
everything about the Pencil needs the physical iPad (8th gen, `AAB487DD-1610-525F-A8E5-3E29666A8B90`).

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
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-09-06-ipad-pdf-ink-verification-checklist.md
git commit -m "docs(pdf-ink): device verification checklist

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 5: Hand the device build to the developer**

Build and install on the cabled iPad exactly as the checklist's header says, then stop: the Pencil steps are the developer's to run. Report which steps the simulator already covered (finger drawing, persistence across reopen, Done, delete-on-empty) and which remain.
