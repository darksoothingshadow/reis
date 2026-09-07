import PDFKit

/**
 * A page the student added, and the page arithmetic that goes with it.
 *
 * reIS never rewrites the PDF: the bytes on disk stay the ones IS served, so a
 * re-upload can replace them and the ink still lands on the right pages. An
 * added page is therefore a fact about the ink, not about the file — the ink
 * archive records where it sits and the reader rebuilds the same document on
 * every open.
 *
 * The arithmetic is here rather than in the view controller because it is the
 * part that can be wrong in a way nobody sees for weeks: an off-by-one shifts
 * every stroke after the insertion onto the neighbouring page.
 */
enum InkPages {
    /// Everything from `at` down moves one page further in.
    static func shifted<Value>(_ pages: [Int: Value], insertingAt at: Int) -> [Int: Value] {
        var moved: [Int: Value] = [:]
        for (index, value) in pages { moved[index >= at ? index + 1 : index] = value }
        return moved
    }

    /// The same shift for the recorded insertions, plus the new one. Ascending,
    /// which is the order `apply` needs.
    static func shifted(_ inserts: [Int], insertingAt at: Int) -> [Int] {
        (inserts.map { $0 >= at ? $0 + 1 : $0 } + [at]).sorted()
    }

    /// Everything below `at` moves one page back; whatever was on the page
    /// itself goes with it.
    static func shifted<Value>(_ pages: [Int: Value], removingAt at: Int) -> [Int: Value] {
        var moved: [Int: Value] = [:]
        for (index, value) in pages where index != at {
            moved[index > at ? index - 1 : index] = value
        }
        return moved
    }

    static func shifted(_ inserts: [Int], removingAt at: Int) -> [Int] {
        inserts.filter { $0 != at }.map { $0 > at ? $0 - 1 : $0 }.sorted()
    }

    static func blank(size: CGSize) -> PDFPage { BlankPage(size: size) }

    /**
     * Puts the added pages back into a freshly opened document, in ascending
     * order, each one the size of the page it follows.
     *
     * An index past the end is CLAMPED to the end, never dropped: the file may
     * have been re-uploaded shorter, and dropping the page would silently move
     * every inked page after it up by one.
     */
    static func apply(inserts: [Int], to document: PDFDocument) {
        for index in inserts.sorted() {
            let at = min(max(index, 0), document.pageCount)
            let size =
                document.page(at: max(at - 1, 0))?.bounds(for: .mediaBox).size
                ?? CGSize(width: 612, height: 792)
            document.insert(blank(size: size), at: at)
        }
    }
}

/// White paper of a given size. A PDFPage subclass rather than a page borrowed
/// from a generated document: a borrowed page keeps a reference to the document
/// it came from, and renders blank once that one goes away.
final class BlankPage: PDFPage {
    private let size: CGSize

    init(size: CGSize) {
        self.size = size
        super.init()
    }

    override func bounds(for box: PDFDisplayBox) -> CGRect {
        CGRect(origin: .zero, size: size)
    }

    override func draw(with box: PDFDisplayBox, to context: CGContext) {
        context.saveGState()
        context.setFillColor(UIColor.white.cgColor)
        context.fill(bounds(for: box))
        context.restoreGState()
    }
}
