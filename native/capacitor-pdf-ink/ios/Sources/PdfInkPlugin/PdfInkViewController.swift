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

        // Provider and markup mode BEFORE the document: PDFView asks for overlays
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
        NSLog("PdfInk: canvas created for page \(index)")
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
        }
        canvases[index] = nil
    }

    // MARK: - PKCanvasViewDelegate

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
