import PDFKit
import PencilKit
import XCTest

@testable import PdfInkPlugin

/**
 * The wrapper PDFKit is handed for each page.
 *
 * Wrapping the canvas is the kind of change that breaks quietly: PDFKit gives
 * the overlay back when a page scrolls away, the reader matches it by identity
 * to know whose strokes it is holding, and a match that silently stops matching
 * loses the drawing on every page the student scrolls past — in every file, not
 * only ones using what the wrapper was added for.
 */
@available(iOS 16.0, *)
final class PageOverlayTests: XCTestCase {
    func testTheCanvasIsExactlyThePage() {
        let overlay = PageOverlayView()

        overlay.frame = CGRect(x: 0, y: 0, width: 300, height: 500)
        overlay.layoutIfNeeded()

        // A PKDrawing's coordinates are the canvas's. An inset of one point here
        // moves the ink in every archive already on the device.
        XCTAssertEqual(overlay.canvas.frame, overlay.bounds)
    }

    func testTheDrawingIsKeptWhenPdfkitGivesThePageBack() throws {
        let reader = PdfInkViewController(strings: PdfInkStrings(nil), toolPicker: PKToolPicker())
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 820, height: 1000))
        window.rootViewController = reader
        window.isHidden = false
        window.layoutIfNeeded()
        defer { window.isHidden = true }

        let document = try page(CGSize(width: 200, height: 200))
        let inkURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).ink")
        XCTAssertTrue(reader.load(document: document, inkURL: inkURL, title: "test"))
        let first = try XCTUnwrap(document.page(at: 0))

        let overlay = try XCTUnwrap(
            reader.pdfView(PDFView(), overlayViewFor: first) as? PageOverlayView,
            "PDFKit was handed something that is not a page overlay")
        overlay.canvas.drawing = stroke()
        reader.pdfView(PDFView(), willEndDisplayingOverlayView: overlay, for: first)
        XCTAssertTrue(reader.persistNow())

        let archive = try XCTUnwrap(InkStore.load(from: inkURL), "nothing was saved")
        XCTAssertNotNil(archive.pages[0], "the page scrolled away and took its strokes with it")
        InkStore.delete(at: inkURL)
    }

    func testTheSamePageAsksForTheSameOverlay() throws {
        let reader = PdfInkViewController(strings: PdfInkStrings(nil), toolPicker: PKToolPicker())
        reader.loadViewIfNeeded()
        let document = try page(CGSize(width: 200, height: 200))
        let inkURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).ink")
        XCTAssertTrue(reader.load(document: document, inkURL: inkURL, title: "test"))
        let first = try XCTUnwrap(document.page(at: 0))

        let once = reader.pdfView(PDFView(), overlayViewFor: first)
        let twice = reader.pdfView(PDFView(), overlayViewFor: first)

        XCTAssertTrue(once === twice, "a second overlay would leave the first one's strokes behind")
    }

    private func page(_ size: CGSize) throws -> PDFDocument {
        let data = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: size)).pdfData { ctx in
            ctx.beginPage()
            UIColor.white.setFill()
            ctx.cgContext.fill(CGRect(origin: .zero, size: size))
        }
        return try XCTUnwrap(PDFDocument(data: data))
    }

    private func stroke() -> PKDrawing {
        let points = stride(from: 40.0, through: 160.0, by: 4).map { x in
            PKStrokePoint(
                location: CGPoint(x: x, y: 100), timeOffset: 0, size: CGSize(width: 8, height: 8),
                opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
        }
        return PKDrawing(strokes: [
            PKStroke(ink: PKInk(.pen, color: .black), path: PKStrokePath(controlPoints: points, creationDate: Date()))
        ])
    }
}
