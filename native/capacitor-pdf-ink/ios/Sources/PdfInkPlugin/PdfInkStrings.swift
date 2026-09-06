import Capacitor
import Foundation

/**
 * Copy the reader shows, translated by the app and passed in with `open`. The
 * English fallbacks only ever show if the JS side forgot a key; the i18n guard
 * test makes that unlikely. Most bar buttons are system items and need no strings.
 */
struct PdfInkStrings {
    let saveFailedTitle: String
    let saveFailedMessage: String
    let keepEditing: String
    let discard: String
    let openFailed: String
    let addPage: String

    init(_ object: JSObject?) {
        saveFailedTitle = object?["saveFailedTitle"] as? String ?? "Your ink couldn't be saved"
        saveFailedMessage =
            object?["saveFailedMessage"] as? String
            ?? "There may be no space left on this iPad."
        keepEditing = object?["keepEditing"] as? String ?? "Keep editing"
        discard = object?["discard"] as? String ?? "Discard"
        openFailed = object?["openFailed"] as? String ?? "Couldn't open this file."
        addPage = object?["addPage"] as? String ?? "Add a page"
    }
}
