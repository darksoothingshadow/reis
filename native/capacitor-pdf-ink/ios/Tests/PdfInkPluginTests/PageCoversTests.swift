import CoreGraphics
import XCTest

@testable import PdfInkPlugin

/**
 * Two gestures share one finger while covers are being made — drag to create,
 * tap to take away — so which one happened has to be decided somewhere it can
 * be argued with. Getting it wrong deletes a cover the student meant to draw.
 */
final class PageCoversTests: XCTestCase {
    private let existing = [CGRect(x: 0, y: 0, width: 100, height: 100)]

    func testADragMakesTheSameBlockWhicheverCornerItStartedFrom() {
        let downhill = PageCovers.rect(from: CGPoint(x: 10, y: 10), to: CGPoint(x: 90, y: 70))
        let uphill = PageCovers.rect(from: CGPoint(x: 90, y: 70), to: CGPoint(x: 10, y: 10))

        XCTAssertEqual(downhill, CGRect(x: 10, y: 10, width: 80, height: 60))
        XCTAssertEqual(downhill, uphill)
    }

    func testADragTooShortInEitherDirectionIsNotACover() {
        // Nothing to hide behind a sliver, and a sliver is usually a slipped tap.
        XCTAssertNil(PageCovers.rect(from: .zero, to: CGPoint(x: 200, y: 4)))
        XCTAssertNil(PageCovers.rect(from: .zero, to: CGPoint(x: 4, y: 200)))
        XCTAssertNotNil(PageCovers.rect(from: .zero, to: CGPoint(x: 24, y: 24)))
    }

    func testTheCoverUnderAPointIsTheOneOnTop() {
        let stacked = [
            CGRect(x: 0, y: 0, width: 100, height: 100),
            CGRect(x: 20, y: 20, width: 40, height: 40),
        ]

        XCTAssertEqual(PageCovers.index(at: CGPoint(x: 30, y: 30), in: stacked), 1)
        XCTAssertEqual(PageCovers.index(at: CGPoint(x: 80, y: 80), in: stacked), 0)
    }

    func testNoCoverUnderAPointOutsideThemAll() {
        XCTAssertNil(PageCovers.index(at: CGPoint(x: 500, y: 500), in: existing))
    }

    /// The one the two gestures fight over: a small block drawn on top of a big
    /// one is a new cover, not a delete.
    func testALongDragStartingOnACoverMakesANewOne() {
        let gesture = PageCovers.gesture(
            from: CGPoint(x: 10, y: 10), to: CGPoint(x: 60, y: 60), over: existing)

        XCTAssertEqual(gesture, .create(CGRect(x: 10, y: 10, width: 50, height: 50)))
    }

    func testATapOnACoverTakesItAway() {
        let gesture = PageCovers.gesture(
            from: CGPoint(x: 50, y: 50), to: CGPoint(x: 52, y: 51), over: existing)

        XCTAssertEqual(gesture, .remove(0))
    }

    func testATapOnBarePageDoesNothing() {
        let gesture = PageCovers.gesture(
            from: CGPoint(x: 500, y: 500), to: CGPoint(x: 501, y: 500), over: existing)

        XCTAssertEqual(gesture, .nothing)
    }
}

import UIKit

/**
 * Every symbol the reader's bar asks for, by name.
 *
 * `UIImage(systemName:)` returns nil for a name that does not exist and a bar
 * button with a nil image is a circle with nothing in it — which is exactly how
 * the sidebar toggle broke on the iPad. A name is a string; nothing else checks
 * it.
 */
@available(iOS 16.0, *)
final class BarSymbolTests: XCTestCase {
    func testEverySymbolTheBarAsksForExists() {
        for name in [
            "plus.rectangle.portrait", "square.dashed", "square.dashed.inset.filled", "pencil.tip",
        ] {
            XCTAssertNotNil(UIImage(systemName: name), "\(name) is not a symbol on this OS")
        }
    }

    func testTheCoverButtonHasAPictureInBothStates() {
        XCTAssertNotNil(PdfInkViewController.coverImage(making: false))
        XCTAssertNotNil(PdfInkViewController.coverImage(making: true))
    }
}

/// Reading mode: a finger that travelled was going somewhere.
@available(iOS 16.0, *)
final class CoverTapTests: XCTestCase {
    func testAStillFingerIsATap() {
        XCTAssertTrue(PageCovers.isTap(from: CGPoint(x: 50, y: 50), to: CGPoint(x: 53, y: 47)))
    }

    func testAFingerThatTravelledIsNot() {
        // A scroll that happens to start on a cover must not open the answer.
        XCTAssertFalse(PageCovers.isTap(from: CGPoint(x: 50, y: 50), to: CGPoint(x: 50, y: 300)))
        XCTAssertFalse(PageCovers.isTap(from: CGPoint(x: 50, y: 50), to: CGPoint(x: 300, y: 50)))
    }
}
