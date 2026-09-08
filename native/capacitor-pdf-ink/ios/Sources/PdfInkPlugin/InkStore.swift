import Foundation

/**
 * The ink file's only reader and writer. Writes are atomic; a file that does not
 * decode is moved aside as `<name>.ink.bad` so nothing the student drew is
 * silently overwritten, and the reader starts empty.
 */
enum InkStore {
    static func load(from url: URL) -> InkArchive? {
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        do {
            return try InkArchive.decode(try Data(contentsOf: url))
        } catch {
            NSLog("PdfInk: ink at \(url.lastPathComponent) unreadable (\(error)); quarantined")
            quarantine(url)
            return nil
        }
    }

    static func save(_ archive: InkArchive, to url: URL) throws {
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try archive.encoded().write(to: url, options: .atomic)
    }

    static func delete(at url: URL) {
        try? FileManager.default.removeItem(at: url)
        NSLog("PdfInk: ink deleted for \(url.lastPathComponent)")
    }

    /// `<name>.ink.bad`, or `<name>.ink.bad.<uuid>` when an earlier quarantine
    /// copy already sits there — a second corruption must not erase the first.
    private static func quarantine(_ url: URL) {
        var bad = url.appendingPathExtension("bad")
        if FileManager.default.fileExists(atPath: bad.path) {
            bad = url.appendingPathExtension("bad.\(UUID().uuidString)")
        }
        try? FileManager.default.moveItem(at: url, to: bad)
    }
}
