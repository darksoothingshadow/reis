import PencilKit
import UIKit

/**
 * What PDFKit puts over one page.
 *
 * The canvas used to be handed to PDFKit directly. It is wrapped now so that
 * more than one thing can sit over a page, and the wrapper does exactly one
 * job: keep the canvas the same size as the page.
 *
 * That size is load-bearing. A `PKDrawing`'s coordinates are the canvas's
 * coordinates, and every archive ever written assumed those are the page's — an
 * inset of a single point here moves the ink in every file on the device.
 */
final class PageOverlayView: UIView {
    let canvas = PKCanvasView()
    /// Above the ink: a cover hides the student's own answer as readily as the
    /// teacher's.
    let coverLayer = CoverLayerView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        addSubview(canvas)
        addSubview(coverLayer)
    }

    required init?(coder: NSCoder) { fatalError("PageOverlayView is code-only") }

    override func layoutSubviews() {
        super.layoutSubviews()
        canvas.frame = bounds
        coverLayer.frame = bounds
    }
}
