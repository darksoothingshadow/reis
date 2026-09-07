import PencilKit
import UIKit

/**
 * One half of the reader: a reader, the navigation controller that gives it a
 * bar of its own, and what it is showing.
 *
 * Each half keeps its own bar because the title and the buttons belong to one
 * file. A single bar over two files would need every button to answer "which
 * one?" first — a mode, which is the thing this reader keeps not having.
 */
@available(iOS 16.0, *)
final class ReaderPane {
    let reader: PdfInkViewController
    let controller: UINavigationController
    var state = PaneState()

    init(strings: PdfInkStrings, toolPicker: PKToolPicker) {
        reader = PdfInkViewController(strings: strings, toolPicker: toolPicker)
        controller = UINavigationController(rootViewController: reader)
    }
}
