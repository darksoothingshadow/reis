import PDFKit
import UIKit

/**
 * One subject's PDFs in a Notes-style space: Apple's split view with the file
 * list on the left and the reader on the right, the system sidebar toggle in the
 * reader's bar, and a system Close on the list. The space owns switching: a
 * cached file loads at once; anything else is requested from the app through
 * `onNeedsFile` and shown when `deliver` arrives. Closing persists first and
 * reports every link that was displayed.
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
    private var files: [File]
    private var currentLink: String
    private var pendingLink: String?
    private var shown: [String] = []
    private var closed = false

    init(courseTitle: String, files: [File], currentLink: String, strings: PdfInkStrings) {
        self.files = files
        self.currentLink = currentLink
        self.strings = strings
        reader = PdfInkViewController(strings: strings)
        list = FileListViewController(
            title: courseTitle,
            items: files.map {
                .init(
                    link: $0.link, name: $0.name, date: $0.date,
                    hasInk: FileManager.default.fileExists(atPath: $0.inkURL.path))
            })
        super.init()

        split.preferredDisplayMode = .oneBesideSecondary
        split.preferredSplitBehavior = .tile
        split.primaryBackgroundStyle = .sidebar
        split.displayModeButtonVisibility = .automatic
        split.presentsWithGesture = true
        split.modalPresentationStyle = .fullScreen
        split.setViewController(list, for: .primary)
        split.setViewController(UINavigationController(rootViewController: reader), for: .secondary)

        list.onSelect = { [weak self] link in self?.select(link: link) }
        list.onClose = { [weak self] in self?.closeTapped() }
    }

    /// Shows the initial file; the plugin has already proved PDFKit can open it.
    func start(with document: PDFDocument) {
        guard let file = files.first(where: { $0.link == currentLink }) else { return }
        reader.load(document: document, inkURL: file.inkURL, title: file.name)
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
        reader.showMessage(strings.openFailed)
    }

    private func select(link: String) {
        guard link != currentLink, let file = files.first(where: { $0.link == link }) else { return }
        NSLog("PdfInk: select \(file.name) cached=\(file.pdfURL != nil)")
        let previous = currentLink
        currentLink = link
        pendingLink = nil
        if let url = file.pdfURL {
            show(file, from: url)
        } else {
            reader.showLoading(title: file.name)
            pendingLink = link
            onNeedsFile?(link)
        }
        refreshInkMark(for: previous)
    }

    private func show(_ file: File, from url: URL) {
        guard let document = PDFDocument(url: url), document.pageCount > 0 else {
            reader.showMessage(strings.openFailed)
            return
        }
        reader.load(document: document, inkURL: file.inkURL, title: file.name)
        if !shown.contains(file.link) { shown.append(file.link) }
    }

    private func refreshInkMark(for link: String) {
        guard let file = files.first(where: { $0.link == link }) else { return }
        list.setHasInk(link: link, FileManager.default.fileExists(atPath: file.inkURL.path))
    }

    private func closeTapped() {
        reader.persistNow()
        guard let error = reader.lastSaveError else {
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
