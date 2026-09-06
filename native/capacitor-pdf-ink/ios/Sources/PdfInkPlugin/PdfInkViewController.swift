import PDFKit
import PencilKit
import UIKit

/**
 * A PDFView that can be first responder, so the tool picker has something to be
 * visible for between pages.
 *
 * Deliberately NO `undoManager` override. PencilKit registers each stroke's undo
 * by walking the responder chain from the canvas; an override here that asked the
 * canvas back recursed until the stack overflowed (the first device crash). Left
 * alone, every canvas and this view reach the window's undo manager, which is
 * also what the picker's undo/redo buttons act on.
 */
@available(iOS 16.0, *)
final class InkPDFView: PDFView {
    override var canBecomeFirstResponder: Bool { true }
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
 * Saving is Notes-like: 1 s after the last stroke, before switching files, on
 * Close, and when the app resigns active. Empty ink deletes the file. The reader
 * shows one file at a time; `PdfInkSpace` decides which.
 */
@available(iOS 16.0, *)
final class PdfInkViewController: UIViewController, PDFPageOverlayViewProvider,
    PKCanvasViewDelegate
{
    private let strings: PdfInkStrings
    private let pdfView = InkPDFView()
    private let toolPicker = PKToolPicker()
    private let spinner = UIActivityIndicatorView(style: .large)
    private let message = UILabel()

    private var document: PDFDocument?
    private var inkURL: URL?
    private var drawings: [Int: PKDrawing] = [:]
    private var canvases: [Int: PKCanvasView] = [:]
    private var saveTimer: Timer?
    private(set) var lastSaveError: Error?

    init(strings: PdfInkStrings) {
        self.strings = strings
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("PdfInkViewController is code-only") }

    deinit {
        NotificationCenter.default.removeObserver(self)
        saveTimer?.invalidate()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        // Provider and markup mode BEFORE any document: PDFView asks for overlays
        // as it lays pages out, and a page laid out with no provider never gets a
        // canvas — the touch then scrolls the page instead of drawing on it.
        pdfView.pageOverlayViewProvider = self
        pdfView.isInMarkupMode = true
        pdfView.usePageViewController(false)
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        pdfView.autoScales = true
        pdfView.document = document
        pdfView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(pdfView)

        spinner.hidesWhenStopped = true
        spinner.translatesAutoresizingMaskIntoConstraints = false
        message.textAlignment = .center
        message.textColor = .secondaryLabel
        message.numberOfLines = 0
        message.isHidden = true
        message.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(spinner)
        view.addSubview(message)

        NSLayoutConstraint.activate([
            // Below the navigation bar, not under it. PDFView lays its pages out
            // without honouring the automatic content inset a translucent bar adds,
            // so UIKit decelerates toward -inset while PDFView pushes toward its own
            // top: the offset oscillated and settled 37pt short, hiding the page top
            // under the bar (traced 2026-09-06). With no inset there is no fight.
            pdfView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            pdfView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            pdfView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            pdfView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            message.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            message.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            message.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 32),
            message.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -32),
        ])

        toolPicker.showsDrawingPolicyControls = true
        toolPicker.colorUserInterfaceStyle = .light
        toolPicker.setVisible(true, forFirstResponder: pdfView)

        NotificationCenter.default.addObserver(
            self, selector: #selector(persistNow),
            name: UIApplication.willResignActiveNotification, object: nil)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        pdfView.becomeFirstResponder()
    }

    // MARK: - Files

    /// Persists the current file's ink, then shows another file with its ink.
    func load(document: PDFDocument, inkURL: URL, title: String) {
        // The space loads the first file before presenting anything. The view
        // must exist first: viewDidLoad attaches the overlay provider, and a
        // document laid out without it gets no canvases — the first file could
        // not be drawn on until a switch reloaded it (found 2026-09-06).
        loadViewIfNeeded()
        persistNow()
        drawings = [:]
        canvases = [:]
        self.document = document
        self.inkURL = inkURL
        self.title = title
        if let archive = InkStore.load(from: inkURL) {
            for (index, data) in archive.pages {
                if let drawing = try? PKDrawing(data: data) { drawings[index] = drawing }
            }
        }
        spinner.stopAnimating()
        message.isHidden = true
        pdfView.document = document
        pdfView.becomeFirstResponder()
    }

    /// Blank page and a spinner while the app fetches the bytes.
    func showLoading(title: String) {
        clear(title: title)
        spinner.startAnimating()
    }

    /// Blank page and one sentence; the file stays in the list.
    func showMessage(_ text: String) {
        clear(title: title ?? "")
        message.text = text
        message.isHidden = false
    }

    private func clear(title: String) {
        loadViewIfNeeded()
        persistNow()
        drawings = [:]
        canvases = [:]
        document = nil
        inkURL = nil
        self.title = title
        pdfView.document = nil
        spinner.stopAnimating()
        message.isHidden = true
    }

    func willClose() {
        toolPicker.setVisible(false, forFirstResponder: pdfView)
    }

    // MARK: - PDFPageOverlayViewProvider

    func pdfView(_ view: PDFView, overlayViewFor page: PDFPage) -> UIView? {
        guard let document else { return nil }
        let index = document.index(for: page)
        if let canvas = canvases[index] { return canvas }
        let canvas = PKCanvasView()
        NSLog("PdfInk: canvas created for page \(index)")
        canvas.tag = index
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        // PDF paper is white in any appearance. Without this PencilKit inverts
        // the ink for dark mode and the default pen draws white on white.
        canvas.overrideUserInterfaceStyle = .light
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
        // Matched by identity, not page index: after a file switch PDFKit may
        // still release the previous document's overlays, whose indices would
        // otherwise collide with the new file's canvases.
        guard let canvas = overlayView as? PKCanvasView,
            let index = canvases.first(where: { $0.value === canvas })?.key
        else { return }
        drawings[index] = canvas.drawing
        toolPicker.removeObserver(canvas)
        canvases[index] = nil
    }

    // MARK: - PKCanvasViewDelegate

    func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
        guard canvases[canvasView.tag] === canvasView else { return }
        drawings[canvasView.tag] = canvasView.drawing
        saveTimer?.invalidate()
        saveTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: false) {
            [weak self] _ in self?.persistNow()
        }
    }

    // MARK: - Saving

    private func currentArchive() -> InkArchive? {
        guard let document else { return nil }
        for (index, canvas) in canvases { drawings[index] = canvas.drawing }
        let pages = drawings.filter { !$0.value.strokes.isEmpty }
            .mapValues { $0.dataRepresentation() }
        return InkArchive(pageCount: document.pageCount, pages: pages)
    }

    @objc func persistNow() {
        saveTimer?.invalidate()
        saveTimer = nil
        guard let inkURL, let archive = currentArchive() else { return }
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
}
