import PDFKit
import PencilKit
import UIKit

/**
 * One subject's PDFs in a Notes-style space: Apple's split view with the file
 * list on the left and the reader on the right, the system sidebar toggle in the
 * reader's bar, and a system Close on the list. The space owns switching: a
 * cached file loads at once; anything else is requested from the app through
 * `onNeedsFile` and shown when `deliver` arrives. Closing persists first and
 * reports every link that was displayed.
 *
 * The right-hand side holds one reader or two side by side (`ReaderStackViewController`).
 * A pick from the sidebar loads into the half the student last touched, and a
 * file already open in the other half moves the focus there instead of opening
 * twice — see `SpacePanes` for why that rule is not negotiable.
 *
 * A pane's `currentLink` is the file it is actually showing — "" while it shows
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

    private let list: FileListViewController
    /// One picker for the whole space; the halves borrow it. Two pickers would
    /// mean two pens and two colours — a mode by accident.
    private let toolPicker = PKToolPicker()
    private let stack = ReaderStackViewController()
    private let strings: PdfInkStrings
    private var files: [File]
    private var panes: [ReaderPane]
    /// The half a sidebar pick loads into: the one the student last touched.
    private var focused = 0
    private var roomForTwo = false
    private var shown: [String] = []
    private var closed = false

    init(courseTitle: String, files: [File], currentLink: String, strings: PdfInkStrings) {
        self.files = files
        self.strings = strings
        toolPicker.showsDrawingPolicyControls = true
        toolPicker.colorUserInterfaceStyle = .light
        panes = []
        list = FileListViewController(
            title: courseTitle,
            items: files.map {
                .init(
                    link: $0.link, name: $0.name, date: $0.date,
                    hasInk: FileManager.default.fileExists(atPath: $0.inkURL.path))
            })
        super.init()
        panes = [makePane()]
        panes[0].state.pendingLink = currentLink

        // Opens on the page alone: a student who tapped a file wants to read it,
        // and the sidebar is one tap away on Apple's toggle. Picking another
        // file hides it again for the same reason (see select).
        split.preferredDisplayMode = .secondaryOnly
        split.preferredSplitBehavior = .tile
        split.primaryBackgroundStyle = .sidebar
        // Placed by hand rather than automatically, so a Close can sit beside it
        // — leaving used to mean opening the sidebar first to find the X there.
        split.displayModeButtonVisibility = .never
        split.presentsWithGesture = true
        split.modalPresentationStyle = .fullScreen
        split.setViewController(list, for: .primary)
        // The secondary is the stack, not a reader's navigation controller, so a
        // second file can be put beside the first. The sidebar toggle still lands
        // in the leading half's own bar: each half is a navigation controller.
        stack.setPanes(panes.map(\.controller))
        split.setViewController(stack, for: .secondary)
        // Only the leading half: it is the one carrying the sidebar toggle, and
        // the trailing half's X already means "close this half".
        // If a hand-placed toggle ever stops working, `presentsWithGesture` still
        // brings the sidebar out with a swipe from the edge, and the Close beside
        // it means nobody is stuck in a file either way.
        panes[0].reader.showCloseButton(besides: split.displayModeButtonItem)

        stack.onFocus = { [weak self] index in
            guard let self, index != focused else { return }
            focus(index)
        }
        stack.onWidthChanged = { [weak self] width in self?.widthChanged(width) }
        list.onSelect = { [weak self] link in self?.select(link: link) }
        list.onClose = { [weak self] in self?.closeTapped() }
    }

    private func makePane() -> ReaderPane {
        let pane = ReaderPane(strings: strings, toolPicker: toolPicker)
        pane.reader.onSplitOpen = { [weak self] in self?.openAlongside() }
        pane.reader.onSplitClose = { [weak self] in self?.closeAlongside() }
        pane.reader.onCloseSpace = { [weak self] in self?.closeTapped() }
        return pane
    }

    private var states: [PaneState] { panes.map(\.state) }

    /// Shows the initial file; the plugin has already proved PDFKit can open it.
    func start(with document: PDFDocument) {
        let pane = panes[0]
        guard let link = pane.state.pendingLink,
            let file = files.first(where: { $0.link == link })
        else { return }
        pane.state.pendingLink = nil
        // Nothing is loaded yet, so this cannot be refused.
        pane.reader.load(document: document, inkURL: file.inkURL, title: file.name)
        pane.state.currentLink = file.link
        shown.append(file.link)
        list.select(link: file.link)
    }

    func deliver(link: String, pdfURL: URL) {
        if let row = files.firstIndex(where: { $0.link == link }) { files[row].pdfURL = pdfURL }
        // The half that asked for it, and only that one.
        guard let index = SpacePanes.awaiting(link, in: states),
            let file = files.first(where: { $0.link == link })
        else { return }
        NSLog("PdfInk: deliver \(pdfURL.lastPathComponent) to half \(index)")
        panes[index].state.pendingLink = nil
        show(file, from: pdfURL, in: index)
    }

    func unavailable(link: String) {
        guard let index = SpacePanes.awaiting(link, in: states) else { return }
        let pane = panes[index]
        pane.state.pendingLink = nil
        transition(in: pane) { [strings] discard in
            pane.reader.showMessage(strings.openFailed, discardingUnsaved: discard)
        }
    }

    private func select(link: String) {
        // Already open: go to that half rather than opening the file twice.
        if let index = SpacePanes.holding(link, in: states) {
            if index != focused { focus(index) }
            return
        }
        guard let file = files.first(where: { $0.link == link }) else { return }
        NSLog("PdfInk: select \(file.name) cached=\(file.pdfURL != nil) half=\(focused)")
        split.preferredDisplayMode = .secondaryOnly
        if let url = file.pdfURL {
            show(file, from: url, in: focused)
            return
        }
        let pane = panes[focused]
        transition(in: pane) { [weak self] discard in
            guard let self, pane.reader.showLoading(title: file.name, discardingUnsaved: discard)
            else { return false }
            let previous = pane.state.currentLink
            pane.state.currentLink = ""
            pane.state.pendingLink = link
            refreshInkMark(for: previous)
            onNeedsFile?(link)
            return true
        }
    }

    private func show(_ file: File, from url: URL, in index: Int) {
        let pane = panes[index]
        guard let document = InkDocument.open(at: url) else {
            // The message replaces whatever was on screen, so nothing is current
            // any more — and only once the reader accepted the transition, since
            // a refused one (unsaved ink) leaves the previous file displayed.
            // Without this the student is stuck: `select` refuses a held link,
            // so the file they were reading could not be tapped again.
            transition(in: pane) { [weak self, strings] discard in
                guard let self,
                    pane.reader.showMessage(
                        strings.openFailed, title: file.name, discardingUnsaved: discard)
                else { return false }
                let previous = pane.state.currentLink
                pane.state.currentLink = ""
                refreshInkMark(for: previous)
                return true
            }
            return
        }
        transition(in: pane) { [weak self] discard in
            guard let self,
                pane.reader.load(
                    document: document, inkURL: file.inkURL, title: file.name,
                    discardingUnsaved: discard)
            else { return false }
            let previous = pane.state.currentLink
            pane.state.currentLink = file.link
            if !shown.contains(file.link) { shown.append(file.link) }
            refreshInkMark(for: previous)
            if index == focused { list.select(link: file.link) }
            return true
        }
    }

    // MARK: - Two files side by side

    /**
     * Adds an empty half and opens the sidebar at it. What goes there is the
     * student's pick, not a guess — the file they want beside this one is the
     * whole reason they tapped the button.
     */
    private func openAlongside() {
        guard roomForTwo, panes.count == 1 else { return }
        let pane = makePane()
        _ = pane.reader.showMessage(strings.pickFile)
        panes.append(pane)
        stack.setPanes(panes.map(\.controller))
        updateSplitControls()
        focus(1)
        split.show(.primary)
        NSLog("PdfInk: opened a second half")
    }

    /// Persists before the half goes, and asks rather than dropping strokes.
    private func closeAlongside() {
        guard panes.count == 2 else { return }
        let pane = panes[1]
        guard pane.reader.persistNow() else {
            presentSaveFailed(for: pane) { [weak self] in self?.dropAlongside() }
            return
        }
        dropAlongside()
    }

    private func dropAlongside() {
        guard panes.count == 2 else { return }
        let pane = panes.removeLast()
        focused = 0
        pane.reader.willClose()
        stack.setPanes(panes.map(\.controller))
        updateSplitControls()
        focus(0)
        NSLog("PdfInk: closed the second half")
    }

    /// A half narrower than a page is worse than no split, so the button is gone
    /// below the threshold and an open split folds back to one.
    private func widthChanged(_ width: CGFloat) {
        roomForTwo = SpacePanes.canSplit(width: width)
        if !roomForTwo && panes.count == 2 { closeAlongside() }
        updateSplitControls()
    }

    private func updateSplitControls() {
        panes[0].reader.setSplitControl(panes.count == 1 && roomForTwo ? .open : .none)
        if panes.count == 2 { panes[1].reader.setSplitControl(.close) }
    }

    private func focus(_ index: Int) {
        guard index < panes.count else { return }
        focused = index
        for (position, pane) in panes.enumerated() {
            pane.reader.setFocused(panes.count == 1 || position == focused)
        }
        let link = panes[index].state.currentLink
        if link.isEmpty { list.clearSelection() } else { list.select(link: link) }
    }

    /**
     * Runs a reader transition. The reader refuses one when the current file's
     * ink cannot be saved (disk full); then the student decides — keep editing,
     * or discard those strokes and go ahead. Nothing is ever dropped silently.
     */
    private func transition(in pane: ReaderPane, _ attempt: @escaping (_ discardingUnsaved: Bool) -> Bool) {
        if attempt(false) { return }
        presentSaveFailed(for: pane) { _ = attempt(true) }
    }

    private func refreshInkMark(for link: String) {
        guard let file = files.first(where: { $0.link == link }) else { return }
        list.setHasInk(link: link, FileManager.default.fileExists(atPath: file.inkURL.path))
    }

    private func closeTapped() {
        // Every half is asked to save — `filter`, not `first`, so a failure in
        // one does not stop the other from being written.
        let unsaved = panes.filter { !$0.reader.persistNow() }
        guard let pane = unsaved.first else {
            finish()
            return
        }
        presentSaveFailed(for: pane) { [weak self] in self?.finish() }
    }

    private func presentSaveFailed(for pane: ReaderPane, discard: @escaping () -> Void) {
        let detail = pane.reader.lastSaveError?.localizedDescription ?? ""
        let alert = UIAlertController(
            title: strings.saveFailedTitle,
            message: "\(strings.saveFailedMessage)\n\n\(detail)",
            preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: strings.keepEditing, style: .cancel))
        alert.addAction(UIAlertAction(title: strings.discard, style: .destructive) { _ in discard() })
        split.present(alert, animated: true)
    }

    private func finish() {
        guard !closed else { return }
        closed = true
        for pane in panes { pane.reader.willClose() }
        let shown = self.shown
        split.dismiss(animated: true) { [onClose] in onClose?(shown) }
    }
}
