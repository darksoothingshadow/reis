import UIKit

/**
 * The reader's accent, handed over by the app with `open` so the chrome around
 * Apple's reader carries the reIS theme instead of the system blue.
 *
 * Everything drawn from `tintColor` follows an inherited tint. Bar buttons do
 * not, on iPadOS 26: they are monochrome glass and ignore a tint set on any
 * parent view, so `apply(_:toBarItemsOf:)` puts it on each item instead, which
 * is what the older versions would have inherited anyway.
 *
 * This is the one deliberate exception to "everything the student touches is
 * Apple's". It moves `tintColor` and nothing else — `PKToolPicker`, the share
 * sheet and the paper stay exactly as iPadOS draws them, because none of them
 * can be styled and none of them should be.
 *
 * One hex per appearance, because the theme has one per appearance and no single
 * colour clears 3:1 against both a white and a near-black bar. The app sends
 * `--color-accent` (src/mobile/pdfInkTint.ts), not the lime: #79be15 on a white
 * bar is 2.29:1, measured in src/index.css, well under the 3:1 a control the
 * student has to find and tap has to clear.
 *
 * Anything that does not parse means no tint at all. Half a brand — one
 * appearance ours, the other Apple's — is worse than Apple's.
 */
enum PdfInkTint {
    static func color(fromHex hex: String) -> UIColor? {
        var digits = hex.trimmingCharacters(in: .whitespaces)
        if digits.hasPrefix("#") { digits.removeFirst() }
        // `UInt32(_:radix:)` alone would take "+0054f"; six hex digits is the contract.
        guard digits.count == 6, digits.allSatisfy(\.isHexDigit),
            let value = UInt32(digits, radix: 16)
        else { return nil }
        return UIColor(
            red: CGFloat((value >> 16) & 0xff) / 255,
            green: CGFloat((value >> 8) & 0xff) / 255,
            blue: CGFloat(value & 0xff) / 255,
            alpha: 1)
    }

    /// Bar buttons are the one place an inherited tint is not enough; see
    /// `PdfInkSpace.applyTint`.
    static func apply(_ tint: UIColor, toBarItemsOf item: UINavigationItem) {
        for button in (item.leftBarButtonItems ?? []) + (item.rightBarButtonItems ?? []) {
            button.tintColor = tint
        }
    }

    /// A colour that resolves per appearance, or nil when either hex is missing
    /// or malformed — `tintColor = nil` is how a view goes back to the system tint.
    static func dynamic(light: String?, dark: String?) -> UIColor? {
        guard let light, let dark,
            let lightColor = color(fromHex: light), let darkColor = color(fromHex: dark)
        else { return nil }
        return UIColor { $0.userInterfaceStyle == .dark ? darkColor : lightColor }
    }
}
