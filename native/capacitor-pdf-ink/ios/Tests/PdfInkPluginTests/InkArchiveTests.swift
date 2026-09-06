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

    func testRejectsJunk() {
        XCTAssertThrowsError(try InkArchive.decode(Data("not a plist".utf8)))
    }
}
