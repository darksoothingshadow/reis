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

    func testCoversSurviveARoundTrip() throws {
        let archive = InkArchive(
            pageCount: 2, pages: [:],
            covers: [1: [CGRect(x: 10, y: 20, width: 30, height: 40)]])

        let decoded = try InkArchive.decode(archive.encoded())

        XCTAssertEqual(decoded.covers, [1: [CGRect(x: 10, y: 20, width: 30, height: 40)]])
        XCTAssertEqual(decoded.version, 3)
    }

    /// Every file written before covers existed. They must still open.
    func testReadsAnOlderArchiveAsHavingNoCovers() throws {
        let v2: [String: Any] = [
            "version": 2, "pageCount": 4, "pages": [String: Data](), "insertedPages": [2],
        ]
        let data = try PropertyListSerialization.data(
            fromPropertyList: v2, format: .binary, options: 0)

        let decoded = try InkArchive.decode(data)

        XCTAssertEqual(decoded.insertedPages, [2])
        XCTAssertEqual(decoded.covers, [:])
    }

    func testRejectsJunk() {
        XCTAssertThrowsError(try InkArchive.decode(Data("not a plist".utf8)))
    }
}
