import PDFKit
import PencilKit

/**
 * Baking the ink into a PDF the student can hand to anyone.
 *
 * Everywhere else reIS keeps the strokes beside the file, so the bytes stay the
 * ones IS served and a re-upload cannot orphan the ink. An export is the one
 * place that has to do the opposite: the recipient has no reIS, so the notes
 * must be in the page. The original copy is untouched — this writes a new file.
 *
 * The page content is redrawn through Core Graphics, so text stays text; only
 * the ink is an image, at `inkScale` so it does not look soft next to it.
 */
enum InkExport {
    /// The box PDFKit lays the reader's canvases out in, so the box the strokes
    /// are positioned against. It has to be the same one on both sides here.
    static let box = PDFDisplayBox.cropBox
    static let inkScale: CGFloat = 2

    static func flatten(_ document: PDFDocument, drawings: [Int: PKDrawing], to url: URL) throws {
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect(document.page(at: 0)))
        try renderer.writePDF(to: url) { context in
            for index in 0..<document.pageCount {
                guard let page = document.page(at: index) else { continue }
                let rect = pageRect(page)
                context.beginPage(withBounds: rect, pageInfo: [:])

                // UIKit's PDF context draws top-left down; a PDF page draws
                // bottom-up. Flip for the page, then put it back for the ink,
                // which was drawn in a canvas that is top-left down like UIKit.
                // `page.draw` applies the page's own box origin and rotation.
                let cg = context.cgContext
                cg.saveGState()
                cg.translateBy(x: 0, y: rect.height)
                cg.scaleBy(x: 1, y: -1)
                page.draw(with: box, to: cg)
                cg.restoreGState()

                guard let drawing = drawings[index], !drawing.strokes.isEmpty else { continue }
                drawing.image(from: rect, scale: inkScale).draw(in: rect)
            }
        }
    }

    /// The page as the reader shows it: the display box, turned on its side when
    /// the page is rotated a quarter turn.
    static func pageRect(_ page: PDFPage?) -> CGRect {
        guard let page else { return CGRect(x: 0, y: 0, width: 612, height: 792) }
        let bounds = page.bounds(for: box)
        let turned = page.rotation % 180 != 0
        return CGRect(
            origin: .zero,
            size: turned
                ? CGSize(width: bounds.height, height: bounds.width) : bounds.size)
    }

    /**
     * A filename for the share sheet, from the IS document name.
     *
     * IS names are free text a teacher typed: they carry slashes, colons and the
     * odd newline, and they rarely end in `.pdf`. The student sees this in the
     * share sheet and again in Files, so it keeps its accents and spaces and
     * loses only what a filename cannot hold.
     */
    static func fileName(for title: String) -> String {
        let forbidden = CharacterSet(charactersIn: "/\\:*?\"<>|").union(.controlCharacters)
        let cleaned = title.components(separatedBy: forbidden).joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        var name = cleaned.isEmpty ? "reIS" : String(cleaned.prefix(80))
        if name.lowercased().hasSuffix(".pdf") { name = String(name.dropLast(4)) }
        return "\(name).pdf"
    }
}
