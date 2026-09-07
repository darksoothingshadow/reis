import CoreGraphics

/**
 * What one half of the reader is showing, and the rules for deciding which half
 * a file belongs to — all of it without touching UIKit, so it can be tested.
 *
 * The space shows one file or two side by side, and both halves can have a
 * download in flight at once. The pane is the addressee: bytes go to the pane
 * that asked for them and nowhere else, or a file surfaces in the half the
 * student was reading.
 */
struct PaneState: Equatable {
    /// The file this half shows — "" while it shows a spinner or a message.
    var currentLink = ""
    /// The file this half has asked the app to fetch, if any.
    var pendingLink: String?
}

enum SpacePanes {
    /// Under this the two halves are too narrow to read a page in. 700pt gives
    /// each half 350pt; the narrowest iPad reIS runs on is 810pt across in
    /// portrait and 1080 in landscape, so both orientations split.
    static let minimumSplitWidth: CGFloat = 700

    static func canSplit(width: CGFloat) -> Bool {
        width >= minimumSplitWidth
    }

    /// The half waiting for `link`, if one still is. A delivery nobody is waiting
    /// for is dropped: the student moved on before the bytes arrived.
    static func awaiting(_ link: String, in panes: [PaneState]) -> Int? {
        panes.firstIndex { $0.pendingLink == link }
    }

    /// The half that already shows `link` or is fetching it.
    ///
    /// A file is never opened in both halves at once. They would be two readers
    /// over one ink archive, each saving its own idea of the strokes, and the
    /// second save would take the first one's work with it.
    static func holding(_ link: String, in panes: [PaneState]) -> Int? {
        guard !link.isEmpty else { return nil }
        return panes.firstIndex { $0.currentLink == link || $0.pendingLink == link }
    }
}
