import UIKit

/**
 * The covers over one page, and the touches that make and open them.
 *
 * It sits above the canvas and is invisible to touches that are not about
 * covers: outside a cover `hitTest` returns nothing at all, so drawing and
 * scrolling reach the canvas underneath exactly as before. Inside a cover it
 * takes the touch, which is also why a covered patch cannot be drawn on — it is
 * covered.
 */
final class CoverLayerView: UIView {
    var covers: [CGRect] = [] { didSet { setNeedsDisplay() } }
    /// Which covers are currently being looked under. Never saved: coming back
    /// to a file is the moment the answers should be hidden again.
    var revealed: Set<Int> = [] { didSet { setNeedsDisplay() } }
    /// While making covers the layer takes every touch on the page.
    var isMakingCovers = false { didSet { setNeedsDisplay() } }

    var onCreate: ((CGRect) -> Void)?
    var onRemove: ((Int) -> Void)?
    var onToggle: ((Int) -> Void)?

    private var dragStart: CGPoint?
    private var dragEnd: CGPoint?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        contentMode = .redraw
        // PDF paper is white whatever the iPad's appearance is, the same reason
        // the canvas under this one is forced light.
        overrideUserInterfaceStyle = .light
    }

    required init?(coder: NSCoder) { fatalError("CoverLayerView is code-only") }

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard isUserInteractionEnabled, !isHidden, alpha > 0.01 else { return nil }
        if isMakingCovers { return bounds.contains(point) ? self : nil }
        return PageCovers.index(at: point, in: covers) != nil ? self : nil
    }

    override func draw(_ rect: CGRect) {
        guard let context = UIGraphicsGetCurrentContext() else { return }
        for (index, cover) in covers.enumerated() {
            if revealed.contains(index) {
                // Opened: the answer shows through, with just enough of an
                // outline left that the student can put it back.
                context.setStrokeColor(UIColor.systemGray2.cgColor)
                context.setLineDash(phase: 0, lengths: [4, 4])
                context.stroke(cover.insetBy(dx: 0.5, dy: 0.5), width: 1)
                context.setLineDash(phase: 0, lengths: [])
            } else {
                context.setFillColor(UIColor.systemGray4.cgColor)
                context.fill(cover)
            }
        }
        guard isMakingCovers, let start = dragStart, let end = dragEnd else { return }
        context.setStrokeColor(UIColor.systemGray.cgColor)
        context.setLineDash(phase: 0, lengths: [6, 4])
        context.stroke(
            CGRect(
                x: min(start.x, end.x), y: min(start.y, end.y),
                width: abs(end.x - start.x), height: abs(end.y - start.y)), width: 1)
    }

    // MARK: - Touches

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let point = touches.first?.location(in: self) else { return }
        dragStart = point
        dragEnd = point
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard isMakingCovers, let point = touches.first?.location(in: self) else { return }
        dragEnd = point
        setNeedsDisplay()
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        defer {
            dragStart = nil
            dragEnd = nil
            setNeedsDisplay()
        }
        guard let start = dragStart, let end = touches.first?.location(in: self) else { return }
        guard isMakingCovers else {
            // Reading: a tap on a cover looks under it, and again puts it back.
            if let index = PageCovers.index(at: end, in: covers) { onToggle?(index) }
            return
        }
        switch PageCovers.gesture(from: start, to: end, over: covers) {
        case .create(let rect): onCreate?(rect)
        case .remove(let index): onRemove?(index)
        case .nothing: break
        }
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        dragStart = nil
        dragEnd = nil
        setNeedsDisplay()
    }
}
