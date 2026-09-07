import PencilKit
import UIKit

/**
 * What PDFKit puts over one page.
 *
 * The canvas used to be handed to PDFKit directly. It is wrapped now, and the
 * wrapper does exactly one job: keep the canvas the same size as the page.
 *
 * The cover layer it was introduced for is gone, so the canvas is alone under it
 * again and the wrapper looks pointless. It stays anyway, and the reason is
 * plain caution, not a constraint: `willEndDisplayingOverlayView` would
 * identity-match bare canvases just as well, but unwrapping means touching the
 * one thing in this plugin that must not move (see below) for no gain.
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
