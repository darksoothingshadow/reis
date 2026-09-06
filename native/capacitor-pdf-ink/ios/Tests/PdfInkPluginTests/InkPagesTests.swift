import PDFKit
import XCTest

@testable import PdfInkPlugin

final class InkPagesTests: XCTestCase {
    func testInsertingShiftsEveryDrawingBelowIt() {
        let drawings = [0: "a", 1: "b", 3: "d"]
        XCTAssertEqual(
            InkPages.shifted(drawings, insertingAt: 1), [0: "a", 2: "b", 4: "d"])
    }

    func testInsertingAtTheEndLeavesEveryDrawingAlone() {
        let drawings = [0: "a", 1: "b"]
        XCTAssertEqual(InkPages.shifted(drawings, insertingAt: 2), drawings)
    }

    func testAnInsertRecordsItselfAndPushesLaterInsertsDown() {
        XCTAssertEqual(InkPages.shifted([1, 4], insertingAt: 2), [1, 2, 5])
    }

    func testInsertsStayInAscendingOrder() {
        XCTAssertEqual(InkPages.shifted([3], insertingAt: 1), [1, 4])
    }

    func testBlankPageIsTheSizeItWasAskedFor() {
        let page = InkPages.blank(size: CGSize(width: 400, height: 900))
        XCTAssertEqual(page.bounds(for: .mediaBox), CGRect(x: 0, y: 0, width: 400, height: 900))
    }

    func testApplyingInsertsRebuildsTheDocumentTheStudentLeft() throws {
        let document = try twoPageDocument()
        InkPages.apply(inserts: [1, 3], to: document)
        XCTAssertEqual(document.pageCount, 4)
        XCTAssertTrue(document.page(at: 1) is BlankPage)
        XCTAssertTrue(document.page(at: 3) is BlankPage)
        XCTAssertFalse(document.page(at: 2) is BlankPage)
    }

    /// A re-uploaded PDF can be shorter than the one the ink was drawn on. The
    /// blank page is clamped to the end rather than dropped: dropping it would
    /// shift every ink page after it onto the wrong page.
    func testAnInsertPastTheEndIsClampedNotDropped() throws {
        let document = try twoPageDocument()
        InkPages.apply(inserts: [9], to: document)
        XCTAssertEqual(document.pageCount, 3)
        XCTAssertTrue(document.page(at: 2) is BlankPage)
    }

    private func twoPageDocument() throws -> PDFDocument {
        let bounds = CGRect(x: 0, y: 0, width: 300, height: 400)
        let data = UIGraphicsPDFRenderer(bounds: bounds).pdfData { context in
            context.beginPage()
            context.beginPage()
        }
        return try XCTUnwrap(PDFDocument(data: data))
    }
}
