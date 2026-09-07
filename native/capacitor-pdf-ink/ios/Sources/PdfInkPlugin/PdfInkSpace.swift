import PDFKit
import UIKit

/**
 * One subject's PDFs in a Notes-style space: Apple's split view with the file
 * list on the left and the reader on the right, the system sidebar toggle in the
 * reader's bar, and a system Close on the list — the one way out, since the
 * reader has no Close of its own. The space owns switching: a cached file loads
 * at once; anything else is requested from the app through `onNeedsFile` and
 * shown when `deliver` arrives. Closing persists first and reports every link
 * that was displayed.
 *
 * `currentLink` is the file the reader is actually showing — "" while it shows
 * a spinner or a message — and only becomes a link once that file has loaded,
 * so a pick that fails can simply be tapped again.
 */
@available(iOS 16.0, *)
final class PdfInkSpace: NSObject {
    struct File {
        let link: String
        let name: String
        let date: String
        var pdfURL: URL?
        let inkURL: URL
    }

    let split = UISplitViewController(style: .doubleColumn)
    var onNeedsFile: ((String) -> Void)?
    var onClose: (([String]) -> Void)?

    private let reader: PdfInkViewController
    private let list: FileListViewController
    private let strings: PdfInkStrings
    private let tint: UIColor?
    private var files: [File]
    private var currentLink = ""
    private var pendingLink: String?
    private var shown: [String] = []
    private var closed = false

    init(
        courseTitle: String, files: [File], currentLink: String, strings: PdfInkStrings,
        tint: UIColor? = nil
    ) {
        self.files = files
        self.strings = strings
        self.tint = tint
        reader = PdfInkViewController(strings: strings, tint: tint)
        list = FileListViewController(
            title: courseTitle,
            items: files.map {
                .init(
                    link: $0.link, name: $0.name, date: $0.date,
                    hasInk: FileManager.default.fileExists(atPath: $0.inkURL.path))
            })
        super.init()
        pendingLink = currentLink

        // Opens on the page alone: a student who tapped a file wants to read it,
        // and the sidebar is one tap away on Apple's toggle. Picking another
        // file hides it again for the same reason (see select).
        split.preferredDisplayMode = .secondaryOnly
        split.preferredSplitBehavior = .tile
        split.primaryBackgroundStyle = .sidebar
        // Automatic, and left well alone. Placing the toggle by hand — the only
        // way to get a button of our own beside it — hands out an item with no
        // glyph and no action: an empty circle where the sidebar used to be.
        split.displayModeButtonVisibility = .automatic
        split.presentsWithGesture = true
        split.modalPresentationStyle = .fullScreen
        split.setViewController(list, for: .primary)
        split.setViewController(UINavigationController(rootViewController: reader), for: .secondary)

        list.onSelect = { [weak self] link in self?.select(link: link) }
        list.onClose = { [weak self] in self?.closeTapped() }
    }

    /**
     * Paints the app's accent over the whole space: both columns, both bars and
     * everything they contain. Called by the plugin just before presenting, so
     * this is the first thing that loads `split.view` — never earlier.
     */
    func applyTint() {
        guard let tint else { return }
        split.view.tintColor = tint
        // iPadOS 26 draws bar buttons as monochrome glass and ignores a tint
        // inherited from a parent view: measured on the simulator, the whole bar
        // had no coloured pixel. A tint set on the item itself does get through,
        // and is what iPadOS 16-18 would have taken from the view anyway.
        for controller in [list as UIViewController, reader] {
            controller.loadViewIfNeeded()
            PdfInkTint.apply(tint, toBarItemsOf: controller.navigationItem)
        }
    }

    /// Shows the initial file; the plugin has already proved PDFKit can open it.
    func start(with document: PDFDocument) {
        guard let link = pendingLink, let file = files.first(where: { $0.link == link }) else { return }
        pendingLink = nil
        // Nothing is loaded yet, so this cannot be refused.
        reader.load(document: document, inkURL: file.inkURL, title: file.name)
        currentLink = file.link
        shown.append(file.link)
        list.select(link: file.link)
    }

    func deliver(link: String, pdfURL: URL) {
        NSLog("PdfInk: deliver \(pdfURL.lastPathComponent) pending=\(pendingLink == link)")
        if let row = files.firstIndex(where: { $0.link == link }) { files[row].pdfURL = pdfURL }
        guard link == pendingLink, let file = files.first(where: { $0.link == link }) else { return }
        pendingLink = nil
        show(file, from: pdfURL)
    }

    func unavailable(link: String) {
        guard link == pendingLink else { return }
        pendingLink = nil
        transition { [reader, strings] discard in reader.showMessage(strings.openFailed, discardingUnsaved: discard) }
    }

    private func select(link: String) {
        guard link != currentLink, link != pendingLink,
            let file = files.first(where: { $0.link == link })
        else { return }
        NSLog("PdfInk: select \(file.name) cached=\(file.pdfURL != nil)")
        split.preferredDisplayMode = .secondaryOnly
        if let url = file.pdfURL {
            show(file, from: url)
            return
        }
        transition { [weak self] discard in
            guard let self, reader.showLoading(title: file.name, discardingUnsaved: discard) else {
                return false
            }
            let previous = currentLink
            currentLink = ""
            pendingLink = link
            refreshInkMark(for: previous)
            onNeedsFile?(link)
            return true
        }
    }

    private func show(_ file: File, from url: URL) {
        guard let document = InkDocument.open(at: url) else {
            // The message replaces whatever was on screen, so nothing is current
            // any more — and only once the reader accepted the transition, since
            // a refused one (unsaved ink) leaves the previous file displayed.
            // Without this the student is stuck: `select` refuses `currentLink`,
            // so the file they were reading could not be tapped again.
            transition { [weak self, reader, strings] discard in
                guard let self,
                    reader.showMessage(
                        strings.openFailed, title: file.name, discardingUnsaved: discard)
                else { return false }
                let previous = currentLink
                currentLink = ""
                // Forget the cached copy too, or `select` keeps handing back the
                // same unreadable bytes and `onNeedsFile` is never asked for a
                // replacement — the file could not be recovered by tapping it.
                if let row = files.firstIndex(where: { $0.link == file.link }) {
                    files[row].pdfURL = nil
                }
                refreshInkMark(for: previous)
                return true
            }
            return
        }
        transition { [weak self] discard in
            guard let self,
                reader.load(
                    document: document, inkURL: file.inkURL, title: file.name,
                    discardingUnsaved: discard)
            else { return false }
            let previous = currentLink
            currentLink = file.link
            if !shown.contains(file.link) { shown.append(file.link) }
            refreshInkMark(for: previous)
            return true
        }
    }

    /**
     * Runs a reader transition. The reader refuses one when the current file's
     * ink cannot be saved (disk full); then the student decides — keep editing,
     * or discard those strokes and go ahead. Nothing is ever dropped silently.
     */
    private func transition(_ attempt: @escaping (_ discardingUnsaved: Bool) -> Bool) {
        if attempt(false) { return }
        presentSaveFailed { _ = attempt(true) }
    }

    private func refreshInkMark(for link: String) {
        guard let file = files.first(where: { $0.link == link }) else { return }
        list.setHasInk(link: link, FileManager.default.fileExists(atPath: file.inkURL.path))
    }

    private func closeTapped() {
        if reader.persistNow() {
            finish()
        } else {
            presentSaveFailed { [weak self] in self?.finish() }
        }
    }

    private func presentSaveFailed(discard: @escaping () -> Void) {
        let detail = reader.lastSaveError?.localizedDescription ?? ""
        let alert = UIAlertController(
            title: strings.saveFailedTitle,
            message: "\(strings.saveFailedMessage)\n\n\(detail)",
            preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: strings.keepEditing, style: .cancel))
        alert.addAction(UIAlertAction(title: strings.discard, style: .destructive) { _ in discard() })
        // An alert is presented over the window, not inside `split.view`, so it
        // inherits nothing: every presented thing in here is tinted by hand.
        if let tint { alert.view.tintColor = tint }
        split.present(alert, animated: true)
    }

    private func finish() {
        guard !closed else { return }
        closed = true
        reader.willClose()
        let shown = self.shown
        split.dismiss(animated: true) { [onClose] in onClose?(shown) }
    }
}
