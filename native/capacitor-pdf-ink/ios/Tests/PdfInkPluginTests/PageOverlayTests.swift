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

    /// The point of covers: they are still there next time, and they are shut.
    /// Which ones were open is a fact about one sitting, not about the file.
    func testACoverComesBackAndComesBackShut() throws {
        let reader = PdfInkViewController(strings: PdfInkStrings(nil), toolPicker: PKToolPicker())
        reader.loadViewIfNeeded()
        let document = try page(CGSize(width: 200, height: 200))
        let inkURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).ink")
        XCTAssertTrue(reader.load(document: document, inkURL: inkURL, title: "test"))
        let first = try XCTUnwrap(document.page(at: 0))
        let overlay = try XCTUnwrap(
            reader.pdfView(PDFView(), overlayViewFor: first) as? PageOverlayView)

        let block = CGRect(x: 10, y: 10, width: 60, height: 30)
        overlay.coverLayer.onCreate?(block)
        overlay.coverLayer.onToggle?(0)
        XCTAssertEqual(overlay.coverLayer.revealed, [0], "tapping it did not open it")

        // Away and back, the way closing the file and opening it again goes.
        let reopened = PdfInkViewController(
            strings: PdfInkStrings(nil), toolPicker: PKToolPicker())
        reopened.loadViewIfNeeded()
        let again = try page(CGSize(width: 200, height: 200))
        XCTAssertTrue(reopened.load(document: again, inkURL: inkURL, title: "test"))
        let reopenedOverlay = try XCTUnwrap(
            reopened.pdfView(PDFView(), overlayViewFor: try XCTUnwrap(again.page(at: 0)))
                as? PageOverlayView)

        XCTAssertEqual(reopenedOverlay.coverLayer.covers, [block], "the cover was not kept")
        XCTAssertTrue(reopenedOverlay.coverLayer.revealed.isEmpty, "it came back already open")
        InkStore.delete(at: inkURL)
    }

    /// A cover is the only thing in the file: it still has to be worth a file.
    func testAFileWithOnlyCoversIsNotThrownAway() throws {
        let reader = PdfInkViewController(strings: PdfInkStrings(nil), toolPicker: PKToolPicker())
        reader.loadViewIfNeeded()
        let document = try page(CGSize(width: 200, height: 200))
        let inkURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).ink")
        XCTAssertTrue(reader.load(document: document, inkURL: inkURL, title: "test"))
        let overlay = try XCTUnwrap(
            reader.pdfView(PDFView(), overlayViewFor: try XCTUnwrap(document.page(at: 0)))
                as? PageOverlayView)

        overlay.coverLayer.onCreate?(CGRect(x: 1, y: 1, width: 40, height: 40))
        XCTAssertTrue(reader.persistNow())

        let archive = try XCTUnwrap(InkStore.load(from: inkURL), "the covers were deleted")
        XCTAssertEqual(archive.covers[0]?.count, 1)
        InkStore.delete(at: inkURL)
    }

    /// The layer is invisible to everything that is not about covers, or drawing
    /// and scrolling would stop working over a page that has one.
    func testTheCoverLayerOnlyTakesTouchesOnACover() {
        let layer = CoverLayerView(frame: CGRect(x: 0, y: 0, width: 200, height: 200))
        layer.covers = [CGRect(x: 0, y: 0, width: 50, height: 50)]

        XCTAssertTrue(layer.hitTest(CGPoint(x: 25, y: 25), with: nil) === layer)
        XCTAssertNil(
            layer.hitTest(CGPoint(x: 150, y: 150), with: nil),
            "bare page touches must reach the canvas underneath")

        layer.isMakingCovers = true
        XCTAssertTrue(
            layer.hitTest(CGPoint(x: 150, y: 150), with: nil) === layer,
            "a new cover has to be draggable on bare page")
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
