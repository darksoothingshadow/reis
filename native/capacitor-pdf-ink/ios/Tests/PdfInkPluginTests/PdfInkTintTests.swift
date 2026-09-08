import UIKit
import XCTest

@testable import PdfInkPlugin

final class PdfInkTintTests: XCTestCase {
    private func rgb(_ color: UIColor) -> [Int] {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        color.getRed(&r, green: &g, blue: &b, alpha: &a)
        return [r, g, b, a].map { Int(($0 * 255).rounded()) }
    }

    func testReadsSixDigitHex() throws {
        let color = try XCTUnwrap(PdfInkTint.color(fromHex: "#00548f"))
        XCTAssertEqual(rgb(color), [0, 0x54, 0x8f, 255])
    }

    func testAcceptsUppercaseAndAMissingHash() throws {
        XCTAssertEqual(rgb(try XCTUnwrap(PdfInkTint.color(fromHex: "3B82F6"))), [0x3b, 0x82, 0xf6, 255])
    }

    func testRejectsAnythingThatIsNotSixHexDigits() {
        for bad in ["", "#fff", "#00548", "#00548fff", "#00548g", "not a color"] {
            XCTAssertNil(PdfInkTint.color(fromHex: bad), "\(bad) should not parse")
        }
    }

    func testDynamicResolvesOneHexPerAppearance() throws {
        let tint = try XCTUnwrap(PdfInkTint.dynamic(light: "#00548f", dark: "#3b82f6"))
        XCTAssertEqual(rgb(tint.resolvedColor(with: .init(userInterfaceStyle: .light))), [0, 0x54, 0x8f, 255])
        XCTAssertEqual(rgb(tint.resolvedColor(with: .init(userInterfaceStyle: .dark))), [0x3b, 0x82, 0xf6, 255])
    }

    /// No tint, or one the app got wrong, leaves the reader on the system tint
    /// rather than on half a brand: `nil` is what `tintColor` wants for that.
    func testDynamicIsNilUnlessBothHexesParse() {
        XCTAssertNil(PdfInkTint.dynamic(light: nil, dark: nil))
        XCTAssertNil(PdfInkTint.dynamic(light: "#00548f", dark: nil))
        XCTAssertNil(PdfInkTint.dynamic(light: "lime", dark: "#3b82f6"))
    }
}
