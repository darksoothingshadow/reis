import PDFKit
import UIKit
import XCTest
@testable import PdfInkPlugin

final class InkDocumentTests: XCTestCase {
    private var dir: URL!

    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: dir)
    }

    func testJunkIsNotADocument() throws {
        let url = dir.appendingPathComponent("junk.pdf")
        try Data("<html>IS served a page</html>".utf8).write(to: url)
        XCTAssertNil(InkDocument.open(at: url))
    }

    func testMissingFileIsNotADocument() {
        XCTAssertNil(InkDocument.open(at: dir.appendingPathComponent("missing.pdf")))
    }

    func testARealPageOpens() throws {
        let url = dir.appendingPathComponent("real.pdf")
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 200, height: 300))
        try renderer.pdfData { context in context.beginPage() }.write(to: url)
        XCTAssertEqual(InkDocument.open(at: url)?.pageCount, 1)
    }
}
