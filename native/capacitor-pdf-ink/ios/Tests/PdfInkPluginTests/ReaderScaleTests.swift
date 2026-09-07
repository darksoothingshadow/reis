import PDFKit
import PencilKit
import XCTest

@testable import PdfInkPlugin

/**
 * How big the page is drawn when the reader changes width.
 *
 * This is the split view's doing — a half is half as wide as the whole — but it
 * is the single reader's behaviour, and PDFKit gets it wrong twice: it fits a
 * page to the view when the document is set and never again, and writing
 * `scaleFactor` to correct that switches its auto-fit off for good.
 */
@available(iOS 16.0, *)
final class ReaderScaleTests: XCTestCase {
    private let full: CGFloat = 820
    private let half: CGFloat = 410

    func testAPageFitsTheReaderItIsLoadedInto() throws {
        let reader = try show(width: full)
        try open(reader, page: CGSize(width: 200, height: 200))

        XCTAssertEqual(reader.pageScale, reader.fittedPageScale, accuracy: 0.01)
    }

    /// The split itself: the half narrows and the page has to narrow with it.
    func testNarrowingTheReaderKeepsThePageFitted() throws {
        let reader = try show(width: full)
        try open(reader, page: CGSize(width: 200, height: 200))
        let wide = reader.pageScale

        resize(reader, to: half)

        XCTAssertLessThan(reader.pageScale, wide, "the page did not narrow with the half")
        XCTAssertEqual(reader.pageScale, reader.fittedPageScale, accuracy: 0.01)
    }

    /// The regression the narrowing fix caused: correcting the scale by hand
    /// switches PDFKit's auto-fit off, and the next file then opened in that half
    /// kept the previous one's zoom and hung off the edge.
    func testAFileOpenedInANarrowedReaderFitsIt() throws {
        let reader = try show(width: full)
        try open(reader, page: CGSize(width: 200, height: 200))
        resize(reader, to: half)

        // A different page size, or a stale scale would happen to look correct.
        try open(reader, page: CGSize(width: 400, height: 400))

        XCTAssertEqual(reader.pageScale, reader.fittedPageScale, accuracy: 0.01)
    }

    /// A student who pinched in keeps what they pinched to, in proportion: half
    /// the width means half the page, not back out to the whole of it.
    ///
    /// A page rather than a postage stamp, and 1.5x rather than 2x, because
    /// PDFKit clamps at `maxScaleFactor` and a clamped zoom tests the clamp.
    func testAPinchSurvivesTheReaderChangingWidth() throws {
        let reader = try show(width: full)
        try open(reader, page: CGSize(width: 600, height: 800))
        reader.pageScale = reader.fittedPageScale * 1.5
        let pinchedTo = reader.pageScale / reader.fittedPageScale
        XCTAssertEqual(pinchedTo, 1.5, accuracy: 0.01, "PDFKit clamped the pinch; pick a smaller one")

        resize(reader, to: half)

        XCTAssertEqual(reader.pageScale / reader.fittedPageScale, pinchedTo, accuracy: 0.05)
    }

    /// Adding a page hands the document back to PDFKit from scratch. That must
    /// not double as a "reset the zoom" — the student is mid-edit.
    func testAddingAPageKeepsTheZoom() throws {
        let reader = try show(width: full)
        try open(reader, page: CGSize(width: 200, height: 200))
        reader.pageScale = reader.fittedPageScale * 2
        let zoomed = reader.pageScale

        XCTAssertTrue(reader.addBlankPage())

        XCTAssertEqual(reader.pageScale, zoomed, accuracy: 0.05)
    }

    // MARK: - Helpers

    private var windows: [UIWindow] = []
    private var widths: [ObjectIdentifier: NSLayoutConstraint] = [:]

    /// A reader in a half of its own, the way the stack holds one: the screen
    /// stays the same size and the half is what narrows.
    private func show(width: CGFloat) throws -> PdfInkViewController {
        let reader = PdfInkViewController(strings: PdfInkStrings(nil))
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: full, height: 1000))
        let host = UIViewController()
        window.rootViewController = host
        host.addChild(reader)
        host.view.addSubview(reader.view)
        reader.view.translatesAutoresizingMaskIntoConstraints = false
        let constraint = reader.view.widthAnchor.constraint(equalToConstant: width)
        NSLayoutConstraint.activate([
            reader.view.topAnchor.constraint(equalTo: host.view.topAnchor),
            reader.view.bottomAnchor.constraint(equalTo: host.view.bottomAnchor),
            reader.view.leadingAnchor.constraint(equalTo: host.view.leadingAnchor),
            constraint,
        ])
        reader.didMove(toParent: host)
        window.isHidden = false
        window.layoutIfNeeded()
        windows.append(window)
        widths[ObjectIdentifier(reader)] = constraint
        return reader
    }

    private func resize(_ reader: PdfInkViewController, to width: CGFloat) {
        guard let constraint = widths[ObjectIdentifier(reader)] else {
            return XCTFail("reader is not on screen")
        }
        constraint.constant = width
        reader.view.window?.layoutIfNeeded()
    }

    private func open(_ reader: PdfInkViewController, page size: CGSize) throws {
        let data = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: size)).pdfData { ctx in
            ctx.beginPage()
            UIColor.white.setFill()
            ctx.cgContext.fill(CGRect(origin: .zero, size: size))
        }
        let document = try XCTUnwrap(PDFDocument(data: data))
        let ink = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).ink")
        XCTAssertTrue(reader.load(document: document, inkURL: ink, title: "test"))
        reader.view.layoutIfNeeded()
    }

    override func tearDown() {
        for window in windows { window.isHidden = true }
        windows = []
        super.tearDown()
    }
}

/**
 * The reader's bar.
 *
 * Four tools and nothing else: share, add a page, search, and the page counter.
 * The reader had a Close of its own and a cover tool beside it; both were
 * withdrawn, and leaving is the sidebar's Close.
 *
 * The leading edge is left entirely to the split view. Placing a button of our
 * own beside the sidebar toggle means placing the toggle by hand, and a
 * hand-placed toggle is an empty circle that does nothing — seen on the iPad,
 * which is why the leading items are asserted to stay untouched.
 */
@available(iOS 16.0, *)
final class ReaderBarTests: XCTestCase {
    func testTheLeadingEdgeIsLeftToTheSplitView() {
        let reader = PdfInkViewController(strings: PdfInkStrings(nil))
        reader.loadViewIfNeeded()

        XCTAssertTrue(
            reader.navigationItem.leftBarButtonItems?.isEmpty ?? true,
            "a leading item of ours displaces the sidebar toggle and it never comes back")
    }

    func testTheBarCarriesTheFourFileToolsAndNothingElse() throws {
        let strings = PdfInkStrings(nil)
        let reader = PdfInkViewController(strings: strings)
        reader.loadViewIfNeeded()

        // Right to left, so this reads share on the edge and the counter
        // nearest the title.
        // `map`, not `compactMap`: an item added without an accessibility label
        // would be dropped by compactMap and this assertion would still pass
        // while a fifth button sat in the bar.
        let trailing = try XCTUnwrap(reader.navigationItem.rightBarButtonItems)
        XCTAssertEqual(
            trailing.map(\.accessibilityLabel),
            [strings.export, strings.addPage, strings.search, strings.pages],
            "the reader's bar gained or lost a tool")
    }

    /// The withdrawn Close carried an accessibility label, so its absence is
    /// checkable by name. `close` is still a string — the save-failed alert and
    /// the sidebar's own Close both use it.
    func testTheReadersOwnCloseIsNotBack() throws {
        let strings = PdfInkStrings(nil)
        let reader = PdfInkViewController(strings: strings)
        reader.loadViewIfNeeded()

        let trailing = try XCTUnwrap(reader.navigationItem.rightBarButtonItems)
        XCTAssertFalse(
            trailing.contains { $0.accessibilityLabel == strings.close },
            "the reader's own Close is back; leaving is the sidebar's Close")
    }
}

/**
 * The way out of the space.
 *
 * The reader's own Close was withdrawn, so the sidebar's X is the only one left
 * and its wiring is the whole exit. It is one assignment in `PdfInkSpace.init`
 * and the sort of line a refactor drops silently, which is why it is asserted
 * here rather than left to the device checklist.
 */
@available(iOS 16.0, *)
final class SpaceExitTests: XCTestCase {
    func testTheSidebarsCloseClosesTheSpace() throws {
        let ink = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).ink")
        let space = PdfInkSpace(
            courseTitle: "EBC-AP",
            files: [
                .init(
                    link: "l1", name: "Přednáška 1", date: "1. 1. 2026", pdfURL: nil, inkURL: ink)
            ],
            currentLink: "l1",
            strings: PdfInkStrings(nil))
        var closed = false
        space.onClose = { _ in closed = true }

        let list = try XCTUnwrap(
            space.split.viewController(for: .primary) as? FileListViewController)
        list.loadViewIfNeeded()
        let close = try XCTUnwrap(list.navigationItem.leftBarButtonItem)
        _ = try XCTUnwrap(close.target).perform(try XCTUnwrap(close.action), with: close)

        XCTAssertTrue(closed, "the sidebar's Close did not close the space — there is no way out")
    }
}
