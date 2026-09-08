// swift-tools-version: 5.9
import PackageDescription

// Same shape as native/capacitor-eduroam. `cap sync` reads the package.json next
// to this file, scans `ios/` for `@objc(...)` and generates BOTH the CapApp-SPM
// dependency and the packageClassList entry. The package and product name are
// derived from the npm name (`@reis/capacitor-pdf-ink` → `ReisCapacitorPdfInk`);
// a mismatch fails at dependency resolution.
//
// The test target cannot run with `swift test` on macOS because Capacitor is
// iOS-only and SwiftPM builds every target for tests. Run it through xcodebuild
// against an iPad simulator (README).
let package = Package(
    name: "ReisCapacitorPdfInk",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "ReisCapacitorPdfInk",
            targets: ["PdfInkPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "PdfInkPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
            ],
            path: "ios/Sources/PdfInkPlugin"),
        .testTarget(
            name: "PdfInkPluginTests",
            dependencies: ["PdfInkPlugin"],
            path: "ios/Tests/PdfInkPluginTests"),
    ]
)
