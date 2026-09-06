import Foundation

/**
 * The on-disk shape of one PDF's ink: a binary property list of
 * `{version, pageCount, pages: [pageIndex: PKDrawing.dataRepresentation()]}`.
 *
 * Foundation only — no PencilKit, no UIKit — so it can be unit-tested and so the
 * format is readable without a canvas. `pageCount` is what the PDF had when the
 * ink was saved; the reader lays ink over the current PDF by page index and keeps
 * (but does not show) ink for pages that no longer exist.
 */
struct InkArchive: Codable, Equatable {
    static let currentVersion = 1

    var version: Int
    var pageCount: Int
    var pages: [Int: Data]

    init(pageCount: Int, pages: [Int: Data]) {
        self.version = Self.currentVersion
        self.pageCount = pageCount
        self.pages = pages
    }

    func encoded() throws -> Data {
        let encoder = PropertyListEncoder()
        encoder.outputFormat = .binary
        return try encoder.encode(self)
    }

    /// Fails on junk and on a file written by a NEWER reIS: reading it with an
    /// older decoder could silently drop strokes, and the caller quarantines the
    /// file instead.
    static func decode(_ data: Data) throws -> InkArchive {
        let archive = try PropertyListDecoder().decode(InkArchive.self, from: data)
        guard archive.version <= currentVersion else {
            throw InkArchiveError.unsupportedVersion(archive.version)
        }
        return archive
    }
}

enum InkArchiveError: Error, Equatable {
    case unsupportedVersion(Int)
}
