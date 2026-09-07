import PDFKit
import PencilKit
import XCTest

@testable import PdfInkPlugin

/**
 * Whether a touch on the page can actually reach the cover layer.
 *
 * The layer's own `hitTest` was tested on its own, which proves nothing about
 * the hierarchy it lives in: the canvas is a sibling, PDFKit sets the frames,
 * and a layer that is never laid out is a layer of zero size that no touch will
 * ever land on. This asks the container the question a real touch asks it.
 */
@available(iOS 16.0, *)
final class CoverTouchRoutingTests: XCTestCase {
    private let page = CGRect(x: 0, y: 0, width: 595, height: 842)

    /// PDFKit sets the overlay's frame and nothing else. If the cover layer is
    /// not sized by that alone, every touch misses it.
    func testTheCoverLayerIsSizedByPdfkitSettingTheFrame() {
        let overlay = PageOverlayView()

        overlay.frame = page
        overlay.layoutIfNeeded()

        XCTAssertEqual(overlay.coverLayer.frame, overlay.bounds)
        XCTAssertEqual(overlay.canvas.frame, overlay.bounds)
    }

    func testATouchOnACoverReachesTheCoverLayerAndNotTheCanvas() {
        let overlay = PageOverlayView()
        overlay.frame = page
        overlay.layoutIfNeeded()
        overlay.coverLayer.covers = [CGRect(x: 100, y: 100, width: 200, height: 80)]

        let hit = overlay.hitTest(CGPoint(x: 150, y: 140), with: nil)

        XCTAssertTrue(
            hit === overlay.coverLayer,
            "a tap on a cover landed on \(String(describing: hit)) instead of the cover layer")
    }

    func testATouchOnBarePageReachesTheCanvasSoDrawingStillWorks() {
        let overlay = PageOverlayView()
        overlay.frame = page
        overlay.layoutIfNeeded()
        overlay.coverLayer.covers = [CGRect(x: 100, y: 100, width: 200, height: 80)]

        let hit = overlay.hitTest(CGPoint(x: 450, y: 600), with: nil)

        XCTAssertFalse(
            hit === overlay.coverLayer,
            "the cover layer swallowed a touch on bare page; drawing would stop working")
    }

    /// The one the whole tool rests on: with the tool on, a drag starting on
    /// bare page has to reach the layer or no cover can ever be drawn.
    func testWithTheToolOnABarePageTouchReachesTheCoverLayer() {
        let overlay = PageOverlayView()
        overlay.frame = page
        overlay.layoutIfNeeded()
        overlay.coverLayer.isMakingCovers = true

        let hit = overlay.hitTest(CGPoint(x: 450, y: 600), with: nil)

        XCTAssertTrue(
            hit === overlay.coverLayer,
            "with the tool on, a drag on bare page landed on \(String(describing: hit))")
    }

    /// And the same question asked of a real reader's overlay, frames and all,
    /// rather than one built by hand in the test.
    func testTheOverlayPdfkitIsGivenRoutesTouchesToTheCoverLayer() throws {
        let reader = PdfInkViewController(strings: PdfInkStrings(nil))
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 820, height: 1100))
        window.rootViewController = reader
        window.isHidden = false
        defer { window.isHidden = true }
        window.layoutIfNeeded()

        let data = UIGraphicsPDFRenderer(bounds: page).pdfData { ctx in
            ctx.beginPage()
            UIColor.white.setFill()
            ctx.cgContext.fill(page)
        }
        let document = try XCTUnwrap(PDFDocument(data: data))
        XCTAssertTrue(
            reader.load(
                document: document,
                inkURL: FileManager.default.temporaryDirectory
                    .appendingPathComponent("\(UUID().uuidString).ink"),
                title: "test"))
        window.layoutIfNeeded()

        let overlay = try XCTUnwrap(
            reader.pdfView(PDFView(), overlayViewFor: try XCTUnwrap(document.page(at: 0)))
                as? PageOverlayView)
        overlay.frame = page
        overlay.layoutIfNeeded()
        overlay.coverLayer.onCreate?(CGRect(x: 50, y: 50, width: 120, height: 60))

        let hit = overlay.hitTest(CGPoint(x: 80, y: 70), with: nil)
        XCTAssertTrue(hit === overlay.coverLayer, "the created cover is not tappable")
    }
}
