import PencilKit
import UIKit

/**
 * What PDFKit puts over one page.
 *
 * The canvas used to be handed to PDFKit directly. It is wrapped now, and the
 * wrapper does exactly one job: keep the canvas the same size as the page. The
 * wrapper is what `willEndDisplayingOverlayView` matches on by identity, which
 * is what makes harvesting strokes across a file switch work — so it stays now
 * that the canvas is alone under it again.
 *
 * That size is load-bearing. A `PKDrawing`'s coordinates are the canvas's
 * coordinates, and every archive ever written assumed those are the page's — an
 * inset of a single point here moves the ink in every file on the device.
 */
final class PageOverlayView: UIView {
    let canvas = PKCanvasView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        addSubview(canvas)
    }

    required init?(coder: NSCoder) { fatalError("PageOverlayView is code-only") }

    override func layoutSubviews() {
        super.layoutSubviews()
        canvas.frame = bounds
    }
}
