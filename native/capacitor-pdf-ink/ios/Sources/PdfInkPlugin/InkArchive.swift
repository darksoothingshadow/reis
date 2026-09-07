import Foundation

/**
 * The on-disk shape of one PDF's ink: a binary property list of
 * `{version, pageCount, pages: [pageIndex: PKDrawing.dataRepresentation()],
 * insertedPages: [pageIndex]}`.
 *
 * Foundation only — no PencilKit, no UIKit — so it can be unit-tested and so the
 * format is readable without a canvas. `pageCount` is what the PDF had when the
 * ink was saved; the reader lays ink over the current PDF by page index and keeps
 * (but does not show) ink for pages that no longer exist.
 *
 * `insertedPages` are the blank pages the student added, as indices in the
 * document they were looking at — the PDF itself is never rewritten, so the
 * reader puts them back on every open (InkPages.apply). Version 2 files carry it;
 * version 1 files have no such key and read as an empty list.
 *
 * Version 3 also held `covers`, the blocks put over answers to practise
 * recalling them. That tool was withdrawn and the key is no longer read or
 * written. The version stays at 3 all the same: dropping back to 2 would make
 * every archive already on a device a "newer version", and `decode` quarantines
 * those — the ink would go with them.
 */
struct InkArchive: Codable, Equatable {
    static let currentVersion = 3

    var version: Int
    var pageCount: Int
    var pages: [Int: Data]
    var insertedPages: [Int]

    init(pageCount: Int, pages: [Int: Data], insertedPages: [Int] = []) {
        self.version = Self.currentVersion
        self.pageCount = pageCount
        self.pages = pages
        self.insertedPages = insertedPages
    }

    /// Hand-written so a missing `insertedPages` reads as empty: the synthesised
    /// initialiser fails on an absent key even with a default. A `covers` key
    /// left by the withdrawn tool is simply not read.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        version = try container.decode(Int.self, forKey: .version)
        pageCount = try container.decode(Int.self, forKey: .pageCount)
        pages = try container.decode([Int: Data].self, forKey: .pages)
        insertedPages = try container.decodeIfPresent([Int].self, forKey: .insertedPages) ?? []
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
