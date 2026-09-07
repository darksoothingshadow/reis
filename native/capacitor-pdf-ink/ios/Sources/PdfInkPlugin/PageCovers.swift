import CoreGraphics

/**
 * The blocks a student puts over an answer so they can try to recall it before
 * looking — drag one out, tap to look, tap again to put it back.
 *
 * Only the arithmetic lives here. Two gestures share one finger while covers are
 * being made — drag to create, tap to take one away — and which one happened is
 * decided in one place rather than in a touch handler, because getting it wrong
 * deletes a cover the student meant to draw.
 */
enum PageCovers {
    /// A drag shorter than this in either direction was a tap. Also the smallest
    /// cover worth having: below it there is nothing to hide.
    static let minimumSide: CGFloat = 24

    /// What a drag from one point to another means while covers are being made.
    enum Gesture: Equatable {
        case create(CGRect)
        case remove(Int)
        case nothing
    }

    /// The block a drag covers, whichever corner it started from. Nil when it is
    /// too small to have been meant as one.
    static func rect(from start: CGPoint, to end: CGPoint) -> CGRect? {
        let rect = CGRect(
            x: min(start.x, end.x), y: min(start.y, end.y),
            width: abs(end.x - start.x), height: abs(end.y - start.y))
        guard rect.width >= minimumSide, rect.height >= minimumSide else { return nil }
        return rect
    }

    /// The cover under a point. The last one made wins: it is the one on top.
    static func index(at point: CGPoint, in covers: [CGRect]) -> Int? {
        covers.lastIndex { $0.contains(point) }
    }

    /**
     * Drag long enough and it is a new cover, wherever it started — a small one
     * drawn over a big one is still a new cover, not a delete. Otherwise it was
     * a tap, and a tap on a cover takes it away.
     */
    static func gesture(from start: CGPoint, to end: CGPoint, over covers: [CGRect]) -> Gesture {
        if let rect = rect(from: start, to: end) { return .create(rect) }
        if let index = index(at: start, in: covers) { return .remove(index) }
        return .nothing
    }
}
