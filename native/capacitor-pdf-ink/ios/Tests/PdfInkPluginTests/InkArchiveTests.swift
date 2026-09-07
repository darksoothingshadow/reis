import XCTest
@testable import PdfInkPlugin

final class InkArchiveTests: XCTestCase {
    func testRoundTripsPagesAndPageCount() throws {
        let archive = InkArchive(pageCount: 12, pages: [0: Data([1, 2, 3]), 7: Data([9])])
        let decoded = try InkArchive.decode(archive.encoded())
        XCTAssertEqual(decoded, archive)
        XCTAssertEqual(decoded.version, InkArchive.currentVersion)
    }

    func testRejectsANewerVersion() throws {
        var archive = InkArchive(pageCount: 1, pages: [:])
        archive.version = InkArchive.currentVersion + 1
        XCTAssertThrowsError(try InkArchive.decode(archive.encoded())) { error in
            XCTAssertEqual(
                error as? InkArchiveError,
                .unsupportedVersion(InkArchive.currentVersion + 1))
        }
    }

    func testRoundTripsThePagesTheStudentAdded() throws {
        let archive = InkArchive(pageCount: 3, pages: [:], insertedPages: [1, 2])
        let decoded = try InkArchive.decode(archive.encoded())
        XCTAssertEqual(decoded.insertedPages, [1, 2])
        XCTAssertEqual(decoded.version, InkArchive.currentVersion)
    }

    /// Version 1 files predate added pages and have no such key; they must still
    /// open, with no added pages.
    func testReadsAVersionOneArchiveAsHavingNoAddedPages() throws {
        let v1: [String: Any] = ["version": 1, "pageCount": 4, "pages": [String: Data]()]
        let data = try PropertyListSerialization.data(
            fromPropertyList: v1, format: .binary, options: 0)
        let decoded = try InkArchive.decode(data)
        XCTAssertEqual(decoded.pageCount, 4)
        XCTAssertEqual(decoded.insertedPages, [])
    }

    /// Archives written while the cover tool existed are on devices now. The
    /// key is gone from the struct, so it is simply not read — but the version
    /// stayed at 3 on purpose: dropping back to 2 would make every one of those
    /// files a "newer version", and the reader quarantines those. The ink has to
    /// survive.
    func testAnArchiveCarryingCoversStillOpensWithItsInk() throws {
        let withCovers: [String: Any] = [
            "version": 3, "pageCount": 4, "pages": ["7": Data([1, 2, 3])],
            "insertedPages": [2],
            // Whatever shape the rects were written in: the key is not read at
            // all now, which is the thing under test.
            "covers": ["1": [[10.0, 20.0, 30.0, 40.0]]],
        ]
        let data = try PropertyListSerialization.data(
            fromPropertyList: withCovers, format: .binary, options: 0)

        let decoded = try InkArchive.decode(data)

        XCTAssertEqual(decoded.pages, [7: Data([1, 2, 3])], "the ink was dropped")
        XCTAssertEqual(decoded.insertedPages, [2])
    }

    func testRejectsJunk() {
        XCTAssertThrowsError(try InkArchive.decode(Data("not a plist".utf8)))
    }
}
