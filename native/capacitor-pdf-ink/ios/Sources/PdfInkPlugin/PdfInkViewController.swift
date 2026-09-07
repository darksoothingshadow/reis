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
    PKCanvasViewDelegate, UIAdaptivePresentationControllerDelegate
{
    private let strings: PdfInkStrings
    /// Presented things are not in this view's subtree, so they cannot inherit it.
    private let tint: UIColor?
    private let pdfView = InkPDFView()
    private let toolPicker = PKToolPicker()
    private let spinner = UIActivityIndicatorView(style: .large)
    private let message = UILabel()

    private var document: PDFDocument?
    private var inkURL: URL?
    private var drawings: [Int: PKDrawing] = [:]
    /// What PDFKit currently has over each page. The canvases live inside these.
    private var overlays: [Int: PageOverlayView] = [:]
    /// Where the blank pages the student added sit in the document on screen.
    private var insertedPages: [Int] = []
    private lazy var addPageItem = UIBarButtonItem(
        image: UIImage(systemName: "plus.rectangle.portrait"), style: .plain, target: self,
        action: #selector(addPageTapped))
    private lazy var shareItem = UIBarButtonItem(
        barButtonSystemItem: .action, target: self, action: #selector(shareTapped))
    /// Reads "12/42" and opens the page grid. A lecture deck is unusable without
    /// a way to say where you are and to get somewhere else.
    private lazy var pagesItem = UIBarButtonItem(
        title: "", style: .plain, target: self, action: #selector(pagesTapped))
    private lazy var searchItem = UIBarButtonItem(
        barButtonSystemItem: .search, target: self, action: #selector(searchTapped))
    /// The way out, in the reader's own bar. Installed through
    /// `leadingItemGroups`, which UIKit ADDS beside the split view's automatic
    /// sidebar toggle — proven on the simulator 2026-09-07: the glyph draws,
    /// the action fires, the toggle survives. `leftBarButtonItems` or a
    /// hand-placed `displayModeButtonItem` is the dead empty circle the iPad
    /// showed once; neither is used. UIKit injects its toggle first, so this
    /// lands to the toggle's right, and moves to the leading edge when the
    /// sidebar is open (the toggle goes to the sidebar's own header then).
    ///
    /// `xmark`, not a chevron: this dismisses a full-screen modal, and the
    /// sidebar's control for the same act is already an X. Colour cannot help —
    /// iPadOS 26 bar buttons are monochrome glass and ignore `tintColor`.
    private lazy var exitItem = UIBarButtonItem(
        image: UIImage(systemName: "xmark"), style: .plain, target: self,
        action: #selector(exitTapped))
    private var saveTimer: Timer?
    private var laidOutWidth: CGFloat = 0
    private(set) var lastSaveError: Error?
    /// Fired by the bar's exit. The space wires it to the same `closeTapped()`
    /// the sidebar's X uses, so both doors persist first and share one alert.
    var onCloseSpace: (() -> Void)?

    /// How big the page is drawn, and how big it would be if it just fitted.
    /// `ReaderScaleTests` is the only way the zoom behaviour of a half that
    /// changes width can be checked without a device in hand. Writing the scale
    /// is what a pinch does — PDFKit gives up its own fitting either way — so
    /// the test can stand in for one.
    var pageScale: CGFloat {
        get { pdfView.scaleFactor }
        set { pdfView.scaleFactor = newValue }
    }
    var fittedPageScale: CGFloat { pdfView.scaleFactorForSizeToFit }

    init(strings: PdfInkStrings, tint: UIColor? = nil) {
        self.strings = strings
        self.tint = tint
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

        // Notes and GoodNotes both put "add a page" in the top bar of the page
        // itself; the sidebar toggle owns the other corner.
        addPageItem.accessibilityLabel = strings.addPage
        shareItem.accessibilityLabel = strings.export
        pagesItem.accessibilityLabel = strings.pages
        searchItem.accessibilityLabel = strings.search
        exitItem.accessibilityLabel = strings.close
        setBarItems(enabled: false)
        // Right to left: Share on the edge, as Notes and Files put it, then the
        // two ways of getting somewhere in the file.
        navigationItem.rightBarButtonItems = [shareItem, addPageItem, searchItem, pagesItem]
        // The exit, as a group: see `exitItem`. Not `leftBarButtonItems`.
        navigationItem.leadingItemGroups = [
            UIBarButtonItemGroup(barButtonItems: [exitItem], representativeItem: nil)
        ]

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
            self, selector: #selector(persistOnResignActive),
            name: UIApplication.willResignActiveNotification, object: nil)
        NotificationCenter.default.addObserver(
            self, selector: #selector(updatePageItem), name: .PDFViewPageChanged, object: pdfView)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        pdfView.becomeFirstResponder()
    }

    /**
     * Keeps the page at the same size relative to the half it is in.
     *
     * PDFKit fits a page to the view when the document is set and never again,
     * so a reader that changes width — a rotation, or the iPad sharing the
     * screen with another app — keeps the old zoom and draws the page at the
     * wrong size. The fitted scale is proportional to the view's width, so
     * scaling by the same ratio leaves a fitted page fitted, and a page the
     * student pinched into stays pinched by as much as it was.
     */
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let width = pdfView.bounds.width
        guard width > 0 else { return }
        defer { laidOutWidth = width }
        guard laidOutWidth > 0, width != laidOutWidth, document != nil else { return }
        // Only once the student has pinched. Until then PDFKit is still fitting
        // the page itself and correcting it here applied the change twice, so a
        // half that narrowed drew the page at half the size it should be.
        guard !pdfView.autoScales else { return }
        pdfView.scaleFactor *= width / laidOutWidth
    }

    // MARK: - Files

    /**
     * Persists the current file's ink, then shows another file with its ink.
     * Returns false — and changes nothing — when the current ink could not be
     * saved, so a switch never silently throws strokes away; the space then asks
     * the student and calls again with `discardingUnsaved: true` if they choose so.
     */
    @discardableResult
    func load(document: PDFDocument, inkURL: URL, title: String, discardingUnsaved: Bool = false)
        -> Bool
    {
        // The space loads the first file before presenting anything. The view
        // must exist first: viewDidLoad attaches the overlay provider, and a
        // document laid out without it gets no canvases — the first file could
        // not be drawn on until a switch reloaded it (found 2026-09-06).
        loadViewIfNeeded()
        guard leaveCurrentFile(discardingUnsaved: discardingUnsaved) else { return false }
        self.document = document
        self.inkURL = inkURL
        self.title = title
        if let archive = InkStore.load(from: inkURL) {
            insertedPages = archive.insertedPages
            // Before the document reaches the view: the ink indices below are
            // indices in the document WITH the added pages back in it.
            InkPages.apply(inserts: insertedPages, to: document)
            for (index, data) in archive.pages {
                if let drawing = try? PKDrawing(data: data) { drawings[index] = drawing }
            }
        }
        spinner.stopAnimating()
        message.isHidden = true
        pdfView.document = document
        // Fit the new file to whatever width this half currently has. Writing
        // `scaleFactor` on a width change (viewDidLayoutSubviews) switches
        // PDFKit's auto-fit off, and without this the next file opened in a
        // narrowed half kept the wide file's zoom and hung off the edge.
        pdfView.autoScales = true
        setBarItems(enabled: true)
        updatePageItem()
        pdfView.becomeFirstResponder()
        return true
    }

    /// Blank page and a spinner while the app fetches the bytes. Same contract as `load`.
    func showLoading(title: String, discardingUnsaved: Bool = false) -> Bool {
        guard clear(title: title, discardingUnsaved: discardingUnsaved) else { return false }
        spinner.startAnimating()
        return true
    }

    /// Blank page and one sentence; the file stays in the list. Same contract as
    /// `load`. `title` names the file the message is about — without it the bar
    /// would keep naming the file that was on screen before, which is not the one
    /// that failed.
    func showMessage(_ text: String, title: String? = nil, discardingUnsaved: Bool = false) -> Bool
    {
        guard clear(title: title ?? self.title ?? "", discardingUnsaved: discardingUnsaved) else {
            return false
        }
        message.text = text
        message.isHidden = false
        return true
    }

    private func clear(title: String, discardingUnsaved: Bool) -> Bool {
        loadViewIfNeeded()
        guard leaveCurrentFile(discardingUnsaved: discardingUnsaved) else { return false }
        document = nil
        inkURL = nil
        self.title = title
        pdfView.document = nil
        setBarItems(enabled: false)
        spinner.stopAnimating()
        message.isHidden = true
        return true
    }

    /// Saves and drops the current file's state, or refuses (keeping everything)
    /// when the save fails and the caller has not chosen to discard.
    private func leaveCurrentFile(discardingUnsaved: Bool) -> Bool {
        if !persistNow() && !discardingUnsaved { return false }
        drawings = [:]
        overlays = [:]
        insertedPages = []
        lastSaveError = nil
        return true
    }

    // MARK: - Adding a page

    /**
     * Adds a blank page after the one on screen, the size of that page, and
     * saves at once — an empty page is the only thing an archive may hold, so
     * it survives even if the student never draws on it.
     *
     * The canvases PDFKit is holding are keyed to the page numbers as they were,
     * so their drawings are harvested and the document is handed back to the view
     * from scratch; PDFKit then asks for overlays again against the new numbering.
     */
    /**
     * Hands the document back to PDFKit after the pages have changed underneath
     * it, without moving the student.
     *
     * Re-setting `document` resets the zoom to 100%, and adding a page is not a
     * moment to be zoomed back out to the whole page — they are drawing on it.
     */
    private func reloadDocumentKeepingZoom() {
        let scale = pdfView.scaleFactor
        let fitting = pdfView.autoScales
        pdfView.document = nil
        pdfView.document = document
        if fitting {
            pdfView.autoScales = true
        } else {
            pdfView.scaleFactor = scale
        }
    }

    @discardableResult
    func addBlankPage() -> Bool {
        guard let document, let current = pdfView.currentPage else { return false }
        let at = document.index(for: current) + 1
        harvestCanvases()
        drawings = InkPages.shifted(drawings, insertingAt: at)
        insertedPages = InkPages.shifted(insertedPages, insertingAt: at)
        document.insert(InkPages.blank(size: current.bounds(for: .mediaBox).size), at: at)
        reloadDocumentKeepingZoom()
        if let page = document.page(at: at) { pdfView.go(to: page) }
        updatePageItem()
        pdfView.becomeFirstResponder()
        NSLog("PdfInk: blank page added at \(at)")
        persistNow()
        return true
    }

    @objc private func addPageTapped() {
        addBlankPage()
    }

    /**
     * Removes a page the STUDENT added, and the ink on it.
     *
     * Only their own pages: the PDF itself is never rewritten, so a page of the
     * teacher's file would be back on the next open — the archive records the
     * pages that were added, not the ones that were taken away.
     */
    @discardableResult
    func removeAddedPage(at index: Int) -> Bool {
        guard let document, insertedPages.contains(index), document.pageCount > 1 else {
            return false
        }
        harvestCanvases()
        drawings = InkPages.shifted(drawings, removingAt: index)
        insertedPages = InkPages.shifted(insertedPages, removingAt: index)
        document.removePage(at: index)
        reloadDocumentKeepingZoom()
        if let page = document.page(at: min(index, document.pageCount - 1)) {
            pdfView.go(to: page)
        }
        NSLog("PdfInk: blank page removed at \(index)")
        persistNow()
        updatePageItem()
        return true
    }

    // MARK: - Leaving

    @objc private func exitTapped() { onCloseSpace?() }

    private func setBarItems(enabled: Bool) {
        // Not the exit: a student whose file is loading or failed needs it most.
        addPageItem.isEnabled = enabled
        shareItem.isEnabled = enabled
        pagesItem.isEnabled = enabled
        searchItem.isEnabled = enabled
        // The counter is a pill around a number. With no file open there is no
        // number, and an empty pill reads as a button that lost its label.
        pagesItem.isHidden = !enabled
        if !enabled { pagesItem.title = "" }
    }

    // MARK: - Pages

    @objc private func updatePageItem() {
        guard let document, let page = pdfView.currentPage else { return }
        pagesItem.title = "\(document.index(for: page) + 1)/\(document.pageCount)"
    }

    @objc private func pagesTapped() {
        guard let document, let page = pdfView.currentPage else { return }
        let grid = PageGridViewController(
            document: document, title: strings.pages, current: document.index(for: page),
            strings: strings,
            inked: { [weak self] index in self?.hasInk(onPage: index) ?? false },
            added: { [weak self] index in self?.insertedPages.contains(index) ?? false })
        grid.onPick = { [weak self] index in
            guard let self, let target = self.document?.page(at: index) else { return }
            pdfView.go(to: target)
            updatePageItem()
        }
        grid.onRemove = { [weak self] index in self?.removeAddedPage(at: index) ?? false }
        grid.onDismiss = { [weak self] in self?.showToolPicker() }
        present(inSheet: grid)
    }

    @objc private func searchTapped() {
        guard let document else { return }
        let search = SearchViewController(
            document: document, title: strings.search, pageWord: strings.page,
            noMatches: strings.noMatches)
        search.onPick = { [weak self] match in
            guard let self else { return }
            pdfView.go(to: match)
            pdfView.setCurrentSelection(match, animate: true)
            updatePageItem()
        }
        search.onDismiss = { [weak self] in self?.showToolPicker() }
        present(inSheet: search)
    }

    /// Sheets over the reader share one presentation: half height, and the
    /// floating tool picker out of the way until they are gone.
    private func present(inSheet controller: UIViewController) {
        let sheet = UINavigationController(rootViewController: controller)
        sheet.modalPresentationStyle = .pageSheet
        sheet.sheetPresentationController?.detents = [.medium(), .large()]
        sheet.sheetPresentationController?.prefersGrabberVisible = true
        sheet.presentationController?.delegate = self
        if let tint {
            sheet.view.tintColor = tint
            controller.loadViewIfNeeded()
            PdfInkTint.apply(tint, toBarItemsOf: controller.navigationItem)
        }
        toolPicker.setVisible(false, forFirstResponder: pdfView)
        present(sheet, animated: true)
    }

    private func showToolPicker() {
        toolPicker.setVisible(true, forFirstResponder: pdfView)
        pdfView.becomeFirstResponder()
    }

    /// Swiping a sheet away never reaches its own buttons.
    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        showToolPicker()
    }

    /// A canvas on screen is ahead of `drawings` until the next save, so both are asked.
    private func hasInk(onPage index: Int) -> Bool {
        if let overlay = overlays[index] { return !overlay.canvas.drawing.strokes.isEmpty }
        return !(drawings[index]?.strokes.isEmpty ?? true)
    }

    /// Takes what is on screen back into `drawings` and lets the picker go of it.
    /// Called before the pages are renumbered underneath the canvases.
    private func harvestCanvases() {
        for (index, overlay) in overlays {
            drawings[index] = overlay.canvas.drawing
            toolPicker.removeObserver(overlay.canvas)
        }
        overlays = [:]
    }

    // MARK: - Export

    /**
     * Hands the share sheet a copy of the PDF with the ink baked into the pages
     * — the only form the notes take outside reIS.
     *
     * `persistNow` first: it harvests the canvases that are on screen into
     * `drawings`, so a stroke made inside the save debounce is in the export
     * rather than a second late.
     */
    @objc private func shareTapped() {
        guard let document else { return }
        persistNow()
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(InkExport.fileName(for: title ?? ""))
        do {
            try? FileManager.default.removeItem(at: url)
            try InkExport.flatten(document, drawings: drawings, to: url)
        } catch {
            NSLog("PdfInk: export failed: \(error)")
            let alert = UIAlertController(
                title: strings.exportFailed, message: error.localizedDescription,
                preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: strings.close, style: .cancel))
            if let tint { alert.view.tintColor = tint }
            present(alert, animated: true)
            return
        }
        NSLog("PdfInk: exported \(url.lastPathComponent)")
        let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        // An iPad presents this as a popover and needs the anchor, or it traps.
        share.popoverPresentationController?.barButtonItem = shareItem
        present(share, animated: true)
    }

    func willClose() {
        toolPicker.setVisible(false, forFirstResponder: pdfView)
    }

    // MARK: - PDFPageOverlayViewProvider

    func pdfView(_ view: PDFView, overlayViewFor page: PDFPage) -> UIView? {
        guard let document else { return nil }
        let index = document.index(for: page)
        if let overlay = overlays[index] { return overlay }
        let overlay = PageOverlayView()
        let canvas = overlay.canvas
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
        overlays[index] = overlay
        return overlay
    }

    func pdfView(
        _ view: PDFView, willEndDisplayingOverlayView overlayView: UIView, for page: PDFPage
    ) {
        // Matched by identity, not page index: after a file switch PDFKit may
        // still release the previous document's overlays, whose indices would
        // otherwise collide with the new file's canvases. Matching the WRAPPER
        // is what makes this work now — asking whether it is a canvas would
        // never match again, and the page's strokes would go unharvested.
        guard let overlay = overlayView as? PageOverlayView,
            let index = overlays.first(where: { $0.value === overlay })?.key
        else { return }
        drawings[index] = overlay.canvas.drawing
        toolPicker.removeObserver(overlay.canvas)
        overlays[index] = nil
    }

    // MARK: - PKCanvasViewDelegate

    func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
        guard overlays[canvasView.tag]?.canvas === canvasView else { return }
        drawings[canvasView.tag] = canvasView.drawing
        saveTimer?.invalidate()
        saveTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: false) {
            [weak self] _ in self?.persistNow()
        }
    }

    // MARK: - Saving

    private func currentArchive() -> InkArchive? {
        guard let document else { return nil }
        for (index, overlay) in overlays { drawings[index] = overlay.canvas.drawing }
        let pages = drawings.filter { !$0.value.strokes.isEmpty }
            .mapValues { $0.dataRepresentation() }
        return InkArchive(
            pageCount: document.pageCount, pages: pages, insertedPages: insertedPages)
    }

    /// Writes the current file's ink. False means the strokes are still only in
    /// memory and `lastSaveError` says why.
    @discardableResult
    func persistNow() -> Bool {
        saveTimer?.invalidate()
        saveTimer = nil
        guard let inkURL, let archive = currentArchive() else { return true }
        do {
            if archive.pages.isEmpty && archive.insertedPages.isEmpty {
                InkStore.delete(at: inkURL)
            } else {
                try InkStore.save(archive, to: inkURL)
            }
            lastSaveError = nil
            return true
        } catch {
            lastSaveError = error
            NSLog("PdfInk: save failed: \(error)")
            return false
        }
    }

    @objc private func persistOnResignActive() {
        persistNow()
    }
}
