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
    xcodebuild test -scheme ReisCapacitorPdfInk \
      -destination 'platform=iOS Simulator,name=iPad Air 11-inch (M4)'

`xcodebuild -list` shows the scheme names; `xcrun simctl list devices available` the simulators.
