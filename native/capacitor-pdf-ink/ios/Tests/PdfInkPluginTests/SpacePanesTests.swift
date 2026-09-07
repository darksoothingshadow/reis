import CoreGraphics
import XCTest

@testable import PdfInkPlugin

final class SpacePanesTests: XCTestCase {
    private func pane(_ current: String, pending: String? = nil) -> PaneState {
        PaneState(currentLink: current, pendingLink: pending)
    }

    // MARK: - Routing a delivery

    func testDeliveryGoesToThePaneThatAskedForIt() {
        let panes = [pane("a.pdf"), pane("", pending: "b.pdf")]
        XCTAssertEqual(SpacePanes.awaiting("b.pdf", in: panes), 1)
    }

    func testDeliveryGoesNowhereWhenNoPaneIsWaiting() {
        // The student tapped another file while this one was still downloading.
        let panes = [pane("a.pdf"), pane("c.pdf")]
        XCTAssertNil(SpacePanes.awaiting("b.pdf", in: panes))
    }

    func testAFileShowingInOnePaneIsNotADeliveryTargetForTheOther() {
        let panes = [pane("a.pdf"), pane("", pending: "b.pdf")]
        XCTAssertNil(SpacePanes.awaiting("a.pdf", in: panes))
    }

    /// Defensive: `holding` stops a second pane from ever asking for a file the
    /// first one has, so this cannot happen. If it ever did, one pane gets the
    /// bytes — never both, which would put two savers on one ink archive.
    func testTwoPanesWaitingOnOneFileResolveToASinglePane() {
        let panes = [pane("", pending: "b.pdf"), pane("", pending: "b.pdf")]
        XCTAssertEqual(SpacePanes.awaiting("b.pdf", in: panes), 0)
    }

    // MARK: - One file, one reader

    func testAFileOnScreenIsHeld() {
        XCTAssertEqual(SpacePanes.holding("a.pdf", in: [pane("a.pdf")]), 0)
    }

    func testAFileStillDownloadingIsAlreadyHeld() {
        let panes = [pane("a.pdf"), pane("", pending: "b.pdf")]
        XCTAssertEqual(SpacePanes.holding("b.pdf", in: panes), 1)
    }

    func testAFileNobodyHasIsFree() {
        XCTAssertNil(SpacePanes.holding("z.pdf", in: [pane("a.pdf"), pane("b.pdf")]))
    }

    /// An empty pane shows no file, so "" must not read as a file it holds.
    func testAnEmptyPaneHoldsNothing() {
        XCTAssertNil(SpacePanes.holding("", in: [pane(""), pane("")]))
    }

    // MARK: - Width

    func testTheNarrowestIpadReisRunsOnCanSplitInBothOrientations() {
        // iPad 8: 810pt across in portrait, 1080 in landscape.
        XCTAssertTrue(SpacePanes.canSplit(width: 810))
        XCTAssertTrue(SpacePanes.canSplit(width: 1080))
    }

    func testAHalfNarrowerThan350ptIsRefused() {
        XCTAssertFalse(SpacePanes.canSplit(width: 699))
        XCTAssertTrue(SpacePanes.canSplit(width: 700))
    }
}
