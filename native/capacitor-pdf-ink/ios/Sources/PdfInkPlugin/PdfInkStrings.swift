import Capacitor
import Foundation

/**
 * Copy for the one dialog the reader can show (a failed save), translated by the
 * app and passed in with `open`. The English fallbacks only ever show if the JS
 * side forgot a key; the i18n guard test makes that unlikely.
 */
struct PdfInkStrings {
    let saveFailedTitle: String
    let saveFailedMessage: String
    let keepEditing: String
    let discard: String

    init(_ object: JSObject?) {
        saveFailedTitle = object?["saveFailedTitle"] as? String ?? "Your ink couldn't be saved"
        saveFailedMessage =
            object?["saveFailedMessage"] as? String
            ?? "There may be no space left on this iPad."
        keepEditing = object?["keepEditing"] as? String ?? "Keep editing"
        discard = object?["discard"] as? String ?? "Discard"
    }
}
