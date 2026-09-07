import PDFKit
import PencilKit
import XCTest

@testable import PdfInkPlugin

final class InkExportTests: XCTestCase {
    /// The one that matters: the stroke has to land where the student drew it.
    /// A test that only asks "is any pixel dark" passes even when the ink is
    /// baked into the wrong corner.
    func testTheStrokeIsInThePageWhereItWasDrawn() throws {
        let document = try whitePage(size: CGSize(width: 200, height: 200))
        let drawing = horizontalStroke(y: 100, from: 40, to: 160)
        let url = tempURL()

        try InkExport.flatten(document, drawings: [0: drawing], to: url)

        let out = try XCTUnwrap(PDFDocument(url: url))
        XCTAssertEqual(out.pageCount, 1)
        let pixels = try render(out.page(at: 0), size: CGSize(width: 200, height: 200))
        XCTAssertLessThan(pixels(CGPoint(x: 100, y: 100)), 128, "no ink where the stroke was drawn")
        XCTAssertGreaterThan(pixels(CGPoint(x: 10, y: 10)), 200, "ink bled into an untouched corner")
    }

    func testEveryPageSurvivesAndOnesWithoutInkStayBlank() throws {
        let document = try whitePage(size: CGSize(width: 200, height: 200), pages: 3)
        let url = tempURL()

        try InkExport.flatten(document, drawings: [1: horizontalStroke(y: 100, from: 40, to: 160)], to: url)

        let out = try XCTUnwrap(PDFDocument(url: url))
        XCTAssertEqual(out.pageCount, 3)
        let first = try render(out.page(at: 0), size: CGSize(width: 200, height: 200))
        let second = try render(out.page(at: 1), size: CGSize(width: 200, height: 200))
        XCTAssertGreaterThan(first(CGPoint(x: 100, y: 100)), 200)
        XCTAssertLessThan(second(CGPoint(x: 100, y: 100)), 128)
    }

    func testAPageSizeIsKept() throws {
        let document = try whitePage(size: CGSize(width: 300, height: 500))
        let url = tempURL()
        try InkExport.flatten(document, drawings: [:], to: url)
        let out = try XCTUnwrap(PDFDocument(url: url))
        let bounds = try XCTUnwrap(out.page(at: 0)).bounds(for: .mediaBox)
        XCTAssertEqual(bounds.width, 300, accuracy: 1)
        XCTAssertEqual(bounds.height, 500, accuracy: 1)
    }

    func testFileNameKeepsTheDocumentNameAndDropsWhatAFilenameCannotHold() {
        XCTAssertEqual(InkExport.fileName(for: "Přednáška 09"), "Přednáška 09.pdf")
        XCTAssertEqual(InkExport.fileName(for: "01/2026: Osnova"), "01 2026  Osnova.pdf")
        XCTAssertEqual(InkExport.fileName(for: "Skripta.pdf"), "Skripta.pdf")
        XCTAssertEqual(InkExport.fileName(for: "   "), "reIS.pdf")
    }

    // MARK: - Helpers

    private func tempURL() -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).pdf")
    }

    private func whitePage(size: CGSize, pages: Int = 1) throws -> PDFDocument {
        let data = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: size)).pdfData { ctx in
            for _ in 0..<pages {
                ctx.beginPage()
                UIColor.white.setFill()
                ctx.cgContext.fill(CGRect(origin: .zero, size: size))
            }
        }
        return try XCTUnwrap(PDFDocument(data: data))
    }

    private func horizontalStroke(y: CGFloat, from: CGFloat, to: CGFloat) -> PKDrawing {
        let points = stride(from: from, through: to, by: 4).map { x in
            PKStrokePoint(
                location: CGPoint(x: x, y: y), timeOffset: 0, size: CGSize(width: 8, height: 8),
                opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
        }
        let path = PKStrokePath(controlPoints: points, creationDate: Date())
        return PKDrawing(strokes: [PKStroke(ink: PKInk(.pen, color: .black), path: path)])
    }

    /// Grey value (0 black … 255 white) at a point of the rendered page.
    private func render(_ page: PDFPage?, size: CGSize) throws -> (CGPoint) -> Int {
        let image = try XCTUnwrap(page).thumbnail(of: size, for: .mediaBox)
        let width = Int(size.width), height = Int(size.height)
        var buffer = [UInt8](repeating: 0, count: width * height * 4)
        let context = try XCTUnwrap(
            CGContext(
                data: &buffer, width: width, height: height, bitsPerComponent: 8,
                bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        context.setFillColor(UIColor.white.cgColor)
        context.fill(CGRect(origin: .zero, size: size))
        context.draw(try XCTUnwrap(image.cgImage), in: CGRect(origin: .zero, size: size))
        return { point in
            let x = Int(point.x), y = height - 1 - Int(point.y)
            let offset = (y * width + x) * 4
            return (Int(buffer[offset]) + Int(buffer[offset + 1]) + Int(buffer[offset + 2])) / 3
        }
    }
}
