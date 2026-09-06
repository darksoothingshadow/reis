import Capacitor
import Foundation
import PDFKit
import UIKit

/**
 * `PdfInk`: opens a subject's PDFs in a native PencilKit reader with a Notes-style
 * file sidebar, and resolves when the student closes it. iPad + iPadOS 16 only;
 * JS asks `isAvailable` first and keeps the pdf.js viewer everywhere else.
 *
 * Files the reader does not have are requested with a `needsFile` event; JS
 * answers with `deliverFile` or `fileUnavailable`.
 *
 * Rejection codes the JS side branches on: `unreadable` (PDFKit cannot open the
 * initial file — JS falls back to the web viewer with the same bytes),
 * `unavailable`, `badArguments`, `noHost`.
 */
@objc(PdfInkPlugin)
public class PdfInkPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PdfInkPlugin"
    public let jsName = "PdfInk"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deliverFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fileUnavailable", returnType: CAPPluginReturnPromise),
    ]

    /// The one space that can be open at a time; `open` while one is up rejects.
    private var space: AnyObject?

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
        guard let currentLink = call.getString("currentLink"),
            let rawFiles = call.getArray("files") as? [JSObject]
        else {
            call.reject("open requires currentLink and files", "badArguments")
            return
        }
        let courseTitle = call.getString("courseTitle") ?? ""
        let strings = PdfInkStrings(call.getObject("strings"))

        DispatchQueue.main.async {
            // `supported` already proved this; the guard is for the compiler.
            guard #available(iOS 16.0, *) else { return }
            guard self.space == nil else {
                call.reject("a reader is already open", "busy")
                return
            }
            let files: [PdfInkSpace.File] = rawFiles.compactMap { raw in
                guard let link = raw["link"] as? String, let inkPath = raw["inkPath"] as? String,
                    let inkURL = Self.fileURL(inkPath)
                else { return nil }
                return PdfInkSpace.File(
                    link: link,
                    name: raw["name"] as? String ?? link,
                    date: raw["date"] as? String ?? "",
                    pdfURL: (raw["pdfPath"] as? String).flatMap(Self.fileURL),
                    inkURL: inkURL)
            }
            guard let current = files.first(where: { $0.link == currentLink }),
                let pdfURL = current.pdfURL
            else {
                call.reject("currentLink is not in files, or has no cached pdfPath", "badArguments")
                return
            }
            guard let document = InkDocument.open(at: pdfURL) else {
                call.reject("PDFKit could not open \(pdfURL.lastPathComponent)", "unreadable")
                return
            }
            guard let host = self.bridge?.viewController else {
                call.reject("no view controller to present from", "noHost")
                return
            }
            let space = PdfInkSpace(
                courseTitle: courseTitle, files: files, currentLink: currentLink, strings: strings)
            space.onNeedsFile = { [weak self] link in
                self?.notifyListeners("needsFile", data: ["link": link])
            }
            space.onClose = { [weak self] shown in
                self?.space = nil
                call.resolve(["shown": shown])
            }
            self.space = space
            space.start(with: document)
            host.present(space.split, animated: true)
        }
    }

    @objc func deliverFile(_ call: CAPPluginCall) {
        guard let link = call.getString("link"), let path = call.getString("pdfPath"),
            let url = Self.fileURL(path)
        else {
            call.reject("deliverFile requires link and pdfPath", "badArguments")
            return
        }
        DispatchQueue.main.async {
            if #available(iOS 16.0, *) { (self.space as? PdfInkSpace)?.deliver(link: link, pdfURL: url) }
            call.resolve()
        }
    }

    @objc func fileUnavailable(_ call: CAPPluginCall) {
        guard let link = call.getString("link") else {
            call.reject("fileUnavailable requires link", "badArguments")
            return
        }
        DispatchQueue.main.async {
            if #available(iOS 16.0, *) { (self.space as? PdfInkSpace)?.unavailable(link: link) }
            call.resolve()
        }
    }

    /// Capacitor's `Filesystem.getUri` returns `file:///…`; a bare path is accepted too.
    static func fileURL(_ s: String) -> URL? {
        if let url = URL(string: s), url.isFileURL { return url }
        if s.hasPrefix("/") { return URL(fileURLWithPath: s) }
        return nil
    }
}
