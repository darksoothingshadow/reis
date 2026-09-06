import Capacitor
import Foundation
import PDFKit
import UIKit

/**
 * `PdfInk`: opens a PDF in a native PencilKit reader and resolves when the
 * student taps Done. iPad + iPadOS 16 only; JS asks `isAvailable` first and keeps
 * the pdf.js viewer everywhere else.
 *
 * Rejection codes the JS side branches on: `unreadable` (PDFKit cannot open the
 * file — JS falls back to the web viewer with the same bytes), `unavailable`,
 * `badArguments`, `noHost`.
 */
@objc(PdfInkPlugin)
public class PdfInkPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PdfInkPlugin"
    public let jsName = "PdfInk"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
    ]

    private static var supported: Bool {
        guard #available(iOS 16.0, *) else { return false }
        return UIDevice.current.userInterfaceIdiom == .pad
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": Self.supported])
    }

    @objc func open(_ call: CAPPluginCall) {
        guard Self.supported else {
            call.reject("PdfInk needs an iPad on iPadOS 16 or newer", "unavailable")
            return
        }
        guard let pdfPath = call.getString("pdfPath"), let inkPath = call.getString("inkPath"),
            let pdfURL = Self.fileURL(pdfPath), let inkURL = Self.fileURL(inkPath)
        else {
            call.reject("open requires pdfPath and inkPath as file URIs", "badArguments")
            return
        }
        let title = call.getString("title") ?? pdfURL.lastPathComponent
        let strings = PdfInkStrings(call.getObject("strings"))

        DispatchQueue.main.async {
            // `supported` already proved this; the guard is for the compiler.
            guard #available(iOS 16.0, *) else { return }
            guard let document = PDFDocument(url: pdfURL), document.pageCount > 0 else {
                call.reject("PDFKit could not open \(pdfURL.lastPathComponent)", "unreadable")
                return
            }
            guard let host = self.bridge?.viewController else {
                call.reject("no view controller to present from", "noHost")
                return
            }
            let reader = PdfInkViewController(
                document: document, inkURL: inkURL, title: title, strings: strings
            ) { hasInk in
                call.resolve(["hasInk": hasInk])
            }
            let nav = UINavigationController(rootViewController: reader)
            nav.modalPresentationStyle = .fullScreen
            host.present(nav, animated: true)
        }
    }

    /// Capacitor's `Filesystem.getUri` returns `file:///…`; a bare path is accepted too.
    static func fileURL(_ s: String) -> URL? {
        if let url = URL(string: s), url.isFileURL { return url }
        if s.hasPrefix("/") { return URL(fileURLWithPath: s) }
        return nil
    }
}
