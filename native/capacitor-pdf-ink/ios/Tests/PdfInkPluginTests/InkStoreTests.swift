import XCTest
@testable import PdfInkPlugin

final class InkStoreTests: XCTestCase {
    private var dir: URL!

    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: dir)
    }

    func testSaveCreatesDirectoriesAndLoadReadsBack() throws {
        let url = dir.appendingPathComponent("pdf-ink/abc.ink")
        let archive = InkArchive(pageCount: 3, pages: [1: Data([4, 5])])
        try InkStore.save(archive, to: url)
        XCTAssertEqual(InkStore.load(from: url), archive)
    }

    func testMissingFileLoadsAsNil() {
        XCTAssertNil(InkStore.load(from: dir.appendingPathComponent("none.ink")))
    }

    func testCorruptFileIsQuarantinedNotOverwritten() throws {
        let url = dir.appendingPathComponent("bad.ink")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try Data("garbage".utf8).write(to: url)
        XCTAssertNil(InkStore.load(from: url))
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))
        XCTAssertTrue(
            FileManager.default.fileExists(atPath: url.appendingPathExtension("bad").path))
    }

    func testDeleteRemovesTheFile() throws {
        let url = dir.appendingPathComponent("gone.ink")
        try InkStore.save(InkArchive(pageCount: 1, pages: [0: Data([1])]), to: url)
        InkStore.delete(at: url)
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))
    }
}
