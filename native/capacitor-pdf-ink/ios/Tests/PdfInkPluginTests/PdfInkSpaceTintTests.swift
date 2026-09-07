import PDFKit
import UIKit
import XCTest

@testable import PdfInkPlugin

/**
 * The tint reaches the reader. `PdfInkTintTests` proves a hex becomes a colour;
 * this proves the colour is actually on the view the bar buttons hang off, in
 * both appearances — the plumbing between `open` and the glyphs the student sees.
 */
@available(iOS 16.0, *)
final class PdfInkSpaceTintTests: XCTestCase {
    private var windows: [UIWindow] = []

    override func tearDown() {
        windows.forEach { $0.isHidden = true }
        windows = []
        super.tearDown()
    }

    private func rgb(_ color: UIColor) -> [Int] {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        color.getRed(&r, green: &g, blue: &b, alpha: &a)
        return [r, g, b, a].map { Int(($0 * 255).rounded()) }
    }

    /// A space on screen in one appearance, showing a one-page document.
    private func show(tint: UIColor?, style: UIUserInterfaceStyle) throws -> PdfInkSpace {
        let ink = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).ink")
        let space = PdfInkSpace(
            courseTitle: "Matematika",
            files: [.init(link: "a", name: "Přednáška 09", date: "12. 3. 2026", pdfURL: nil, inkURL: ink)],
            currentLink: "a", strings: PdfInkStrings(nil), tint: tint)

        let size = CGSize(width: 600, height: 800)
        let data = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: size)).pdfData { ctx in
            ctx.beginPage()
            UIColor.white.setFill()
            ctx.cgContext.fill(CGRect(origin: .zero, size: size))
        }
        space.start(with: try XCTUnwrap(PDFDocument(data: data)))
        space.applyTint()

        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 1024, height: 768))
        window.overrideUserInterfaceStyle = style
        window.rootViewController = space.split
        window.isHidden = false
        window.layoutIfNeeded()
        windows.append(window)
        return space
    }

    /// What the reader's bar glyphs are actually drawn with: `tintColor` is a
    /// dynamic colour, and the getter resolves it against whatever traits happen
    /// to be current — not the view's. Only the view's own traits answer this.
    private func readerTint(of space: PdfInkSpace) throws -> [Int] {
        let nav = try XCTUnwrap(space.split.viewController(for: .secondary) as? UINavigationController)
        let view = try XCTUnwrap(nav.topViewController).view!
        return rgb(view.tintColor.resolvedColor(with: view.traitCollection))
    }

    func testTheReaderTakesTheAccentInLight() throws {
        let space = try show(tint: PdfInkTint.dynamic(light: "#00548f", dark: "#3b82f6"), style: .light)
        XCTAssertEqual(try readerTint(of: space), [0, 0x54, 0x8f, 255])
    }

    func testTheReaderTakesTheOtherHexInDark() throws {
        let space = try show(tint: PdfInkTint.dynamic(light: "#00548f", dark: "#3b82f6"), style: .dark)
        XCTAssertEqual(try readerTint(of: space), [0x3b, 0x82, 0xf6, 255])
    }

    /**
     * The page grid is presented, so it inherits nothing and is tinted by hand —
     * and its current-page ring is a `cgColor` on a layer, the one place the
     * tint is resolved rather than inherited. Read back off the layer that
     * actually draws it.
     */
    func testThePageGridsCurrentPageRingTakesTheTint() throws {
        let size = CGSize(width: 200, height: 260)
        let data = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: size)).pdfData { ctx in
            for _ in 0..<3 {
                ctx.beginPage()
                UIColor.white.setFill()
                ctx.cgContext.fill(CGRect(origin: .zero, size: size))
            }
        }
        let grid = PageGridViewController(
            document: try XCTUnwrap(PDFDocument(data: data)), title: "Pages", current: 1,
            strings: PdfInkStrings(nil), inked: { _ in false }, added: { _ in false })
        let sheet = UINavigationController(rootViewController: grid)
        // Exactly what PdfInkViewController.present(inSheet:) does.
        sheet.view.tintColor = PdfInkTint.dynamic(light: "#00548f", dark: "#3b82f6")

        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 700, height: 900))
        window.overrideUserInterfaceStyle = .light
        window.rootViewController = sheet
        window.isHidden = false
        window.layoutIfNeeded()
        windows.append(window)
        grid.collectionView.layoutIfNeeded()

        let cell = try XCTUnwrap(grid.collectionView.cellForItem(at: IndexPath(item: 1, section: 0)))
        let ring = try XCTUnwrap(cell.contentView.subviews.first { $0.layer.borderWidth == 2 })
        XCTAssertEqual(rgb(UIColor(cgColor: try XCTUnwrap(ring.layer.borderColor))), [0, 0x54, 0x8f, 255])
    }

    /// No tint from the app leaves iPadOS's, rather than a colour of our choosing.
    func testWithoutATintTheReaderIsLeftOnTheSystemOne() throws {
        let space = try show(tint: nil, style: .light)
        XCTAssertNotEqual(try readerTint(of: space), [0, 0x54, 0x8f, 255])
    }
}
