import PDFKit

/// The one place that decides whether bytes on disk are a PDF the reader can
/// show. Both the plugin (the tapped file, before presenting anything) and the
/// space (a sidebar pick) go through it, and the test target exercises it.
enum InkDocument {
    /// nil when PDFKit cannot open the file, or it has no pages.
    static func open(at url: URL) -> PDFDocument? {
        guard let document = PDFDocument(url: url), document.pageCount > 0 else { return nil }
        return document
    }
}
