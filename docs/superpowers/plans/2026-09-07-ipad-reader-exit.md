# iPad Reader Exit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put an X in the iPad PDF reader's own bar, beside Apple's sidebar toggle, so a student can leave a subject's PDF space without first opening the sidebar.

**Architecture:** One `UIBarButtonItem` installed through `navigationItem.leadingItemGroups` on `PdfInkViewController` — UIKit adds groups *beside* the split view's automatic toggle, where a hand-placed toggle is the dead empty circle recorded in the repo. The item's action is the reader's existing `onCloseSpace` hook, which `PdfInkSpace` wires to the same `closeTapped()` the sidebar's X uses: one exit path, two buttons.

**Tech Stack:** Swift 5 / UIKit / PDFKit, Swift Package `native/capacitor-pdf-ink`, XCTest on an iPad simulator. No TypeScript changes.

**Spec:** `docs/superpowers/specs/2026-09-07-ipad-reader-exit-design.md`

## Global Constraints

- Glyph is `xmark`, never `chevron.backward`.
- `navigationItem.leadingItemGroups` only. Never `leftBarButtonItems`, never `displayModeButtonItem` by hand. `split.displayModeButtonVisibility` stays `.automatic`.
- No new string: `strings.close` already exists.
- Ours lands to the RIGHT of the toggle; that is accepted, not a bug.
- `setBarItems(enabled:)` must not touch the exit — it works while a file is still loading.
- iPadOS 26 bar buttons ignore `tintColor`; do not try to colour the exit.
- Swift tests: `cd native/capacitor-pdf-ink && xcodebuild test -scheme ReisCapacitorPdfInk -destination 'platform=iOS Simulator,name=iPad Air 11-inch (M4)'`. The scheme is `ReisCapacitorPdfInk`, NOT `ReisCapacitorPdfInk-Package`. Run it from `native/capacitor-pdf-ink`, not from `ios/`.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Work on a branch cut from `claude/pdf-ipad-editing-persistence-688805` (PR #304's head), PR based on `test`.

---

### Task 1: The exit item and its wiring (test first)

**Files:**
- Modify: `native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/ReaderScaleTests.swift` (the `ReaderBarTests` and `SpaceExitTests` classes at the end of the file)
- Modify: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController.swift`
- Modify: `native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkSpace.swift`

**Interfaces:**
- Produces: `PdfInkViewController.onCloseSpace: (() -> Void)?` (public var, set by the space); `PdfInkViewController.exitItem` (private) in `navigationItem.leadingItemGroups[0].barButtonItems[0]`, `accessibilityLabel == strings.close`.
- Consumes: `PdfInkSpace.closeTapped()` (private, already exists — `persistNow()` then `finish()`, save-failed alert in between).

- [ ] **Step 1: Replace the two obsolete bar tests and add the exit tests**

In `ReaderScaleTests.swift`, replace the whole doc comment + class `ReaderBarTests` (from `/**\n * The reader's bar.` through its closing `}`) with:

```swift
/**
 * The reader's bar.
 *
 * Trailing: share, add a page, search, page counter — and nothing else.
 * Leading: our exit, as a `leadingItemGroups` group. UIKit ADDS groups beside
 * the split view's automatic sidebar toggle (proven on the simulator
 * 2026-09-07: the glyph draws, the action fires, the toggle survives), where a
 * hand-placed toggle is a dead empty circle — which is why `leftBarButtonItems`
 * and `displayModeButtonItem` are never touched. The toggle itself is injected
 * at render time and never appears in `navigationItem`, so its survival is the
 * device checklist's to prove, not this file's.
 */
@available(iOS 16.0, *)
final class ReaderBarTests: XCTestCase {
    func testTheExitSitsInTheLeadingGroupAndNothingElseDoes() throws {
        let strings = PdfInkStrings(nil)
        let reader = PdfInkViewController(strings: strings)
        reader.loadViewIfNeeded()

        let groups = reader.navigationItem.leadingItemGroups
        XCTAssertEqual(groups.count, 1, "one group: ours. A second would crowd the toggle")
        XCTAssertEqual(
            groups.first?.barButtonItems.map(\.accessibilityLabel),
            [strings.close],
            "the leading group is the exit and only the exit")
    }

    /// `setBarItems(enabled: false)` has run by now (no file is loaded). The
    /// exit must not be among the items it disables: a student whose file is
    /// still loading, or failed to open, needs the door most of all.
    func testTheExitWorksWhileNoFileIsLoaded() throws {
        let reader = PdfInkViewController(strings: PdfInkStrings(nil))
        reader.loadViewIfNeeded()

        let exit = try XCTUnwrap(reader.navigationItem.leadingItemGroups.first?.barButtonItems.first)
        XCTAssertTrue(exit.isEnabled)
        XCTAssertNotNil(exit.image, "an exit with no glyph is the empty circle again")
    }

    func testTheBarCarriesTheFourFileToolsAndNothingElse() throws {
        let strings = PdfInkStrings(nil)
        let reader = PdfInkViewController(strings: strings)
        reader.loadViewIfNeeded()

        // Right to left, so this reads share on the edge and the counter
        // nearest the title.
        // `map`, not `compactMap`: an item added without an accessibility label
        // would be dropped by compactMap and this assertion would still pass
        // while a fifth button sat in the bar.
        let trailing = try XCTUnwrap(reader.navigationItem.rightBarButtonItems)
        XCTAssertEqual(
            trailing.map(\.accessibilityLabel),
            [strings.export, strings.addPage, strings.search, strings.pages],
            "the reader's bar gained or lost a tool")
    }
}
```

This deletes `testTheLeadingEdgeIsLeftToTheSplitView` and `testTheReadersOwnCloseIsNotBack` — both assert the opposite of the design.

Then replace the doc comment + class `SpaceExitTests` (from `/**\n * The way out of the space.` to end of file) with:

```swift
/**
 * The way out of the space — two buttons, one path.
 *
 * The sidebar's X and the reader's own exit both end in
 * `PdfInkSpace.closeTapped()`: persist first, the save-failed alert if that
 * refuses, `finish()` otherwise. Each wiring is one assignment in
 * `PdfInkSpace.init`, the sort of line a refactor drops silently — which is why
 * both are fired here rather than left to the device checklist. Each of these
 * was checked to FAIL with its wiring commented out before it was committed.
 */
@available(iOS 16.0, *)
final class SpaceExitTests: XCTestCase {
    private func makeSpace() -> PdfInkSpace {
        let ink = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).ink")
        return PdfInkSpace(
            courseTitle: "EBC-AP",
            files: [
                .init(
                    link: "l1", name: "Přednáška 1", date: "1. 1. 2026", pdfURL: nil, inkURL: ink)
            ],
            currentLink: "l1",
            strings: PdfInkStrings(nil))
    }

    func testTheSidebarsCloseClosesTheSpace() throws {
        let space = makeSpace()
        var closed = false
        space.onClose = { _ in closed = true }

        let list = try XCTUnwrap(
            space.split.viewController(for: .primary) as? FileListViewController)
        list.loadViewIfNeeded()
        let close = try XCTUnwrap(list.navigationItem.leftBarButtonItem)
        _ = try XCTUnwrap(close.target).perform(try XCTUnwrap(close.action), with: close)

        XCTAssertTrue(closed, "the sidebar's Close did not close the space")
    }

    func testTheReadersExitClosesTheSpace() throws {
        let space = makeSpace()
        var closed = false
        space.onClose = { _ in closed = true }

        let nav = try XCTUnwrap(
            space.split.viewController(for: .secondary) as? UINavigationController)
        let reader = try XCTUnwrap(nav.topViewController as? PdfInkViewController)
        reader.loadViewIfNeeded()
        let exit = try XCTUnwrap(reader.navigationItem.leadingItemGroups.first?.barButtonItems.first)
        _ = try XCTUnwrap(exit.target).perform(try XCTUnwrap(exit.action), with: exit)

        XCTAssertTrue(closed, "the reader's exit did not close the space")
    }
}
```

- [ ] **Step 2: Run the two classes and watch them fail**

```bash
cd native/capacitor-pdf-ink && xcodebuild test -scheme ReisCapacitorPdfInk -destination 'platform=iOS Simulator,name=iPad Air 11-inch (M4)' -only-testing:PdfInkPluginTests/ReaderBarTests -only-testing:PdfInkPluginTests/SpaceExitTests 2>&1 | grep -E "error:|Test Case|\*\* TEST"
```

Expected: `** TEST FAILED **`. `testTheExitSitsInTheLeadingGroupAndNothingElseDoes` fails on `groups.count` (0 ≠ 1); `testTheExitWorksWhileNoFileIsLoaded` and `testTheReadersExitClosesTheSpace` fail at `XCTUnwrap` (nil). `testTheBarCarriesTheFourFileToolsAndNothingElse` and `testTheSidebarsCloseClosesTheSpace` pass. If anything else fails, the file did not compile — read the `error:` line.

- [ ] **Step 3: Add the exit item to the reader**

In `PdfInkViewController.swift`, directly after the `searchItem` declaration (the line ending `action: #selector(searchTapped))`), add:

```swift
    /// The way out, in the reader's own bar. Installed through
    /// `leadingItemGroups`, which UIKit ADDS beside the split view's automatic
    /// sidebar toggle — proven on the simulator 2026-09-07: the glyph draws,
    /// the action fires, the toggle survives. `leftBarButtonItems` or a
    /// hand-placed `displayModeButtonItem` is the dead empty circle the iPad
    /// showed once; neither is used. UIKit injects its toggle first, so this
    /// lands to the toggle's right, and moves to the leading edge when the
    /// sidebar is open (the toggle goes to the sidebar's own header then).
    ///
    /// `xmark`, not a chevron: this dismisses a full-screen modal, and the
    /// sidebar's control for the same act is already an X. Colour cannot help —
    /// iPadOS 26 bar buttons are monochrome glass and ignore `tintColor`.
    private lazy var exitItem = UIBarButtonItem(
        image: UIImage(systemName: "xmark"), style: .plain, target: self,
        action: #selector(exitTapped))
```

Directly after `private(set) var lastSaveError: Error?` add:

```swift
    /// Fired by the bar's exit. The space wires it to the same `closeTapped()`
    /// the sidebar's X uses, so both doors persist first and share one alert.
    var onCloseSpace: (() -> Void)?
```

In `viewDidLoad`, replace:

```swift
        setBarItems(enabled: false)
        // Right to left: Share on the edge, as Notes and Files put it, then the
        // two ways of getting somewhere in the file. Leaving is the sidebar's
        // Close — nothing here does it.
        navigationItem.rightBarButtonItems = [shareItem, addPageItem, searchItem, pagesItem]
```

with:

```swift
        exitItem.accessibilityLabel = strings.close
        setBarItems(enabled: false)
        // Right to left: Share on the edge, as Notes and Files put it, then the
        // two ways of getting somewhere in the file.
        navigationItem.rightBarButtonItems = [shareItem, addPageItem, searchItem, pagesItem]
        // The exit, as a group: see `exitItem`. Not `leftBarButtonItems`.
        navigationItem.leadingItemGroups = [
            UIBarButtonItemGroup(barButtonItems: [exitItem], representativeItem: nil)
        ]
```

Directly above `private func setBarItems(enabled: Bool) {` add:

```swift
    // MARK: - Leaving

    @objc private func exitTapped() { onCloseSpace?() }

```

In `setBarItems(enabled:)`, add this comment as the first line of the body (the exit is deliberately absent from the list):

```swift
        // Not the exit: a student whose file is loading or failed needs it most.
```

- [ ] **Step 4: Wire the space**

In `PdfInkSpace.swift`, replace:

```swift
        // Automatic, and left well alone. Placing the toggle by hand — the only
        // way to get a button of our own beside it — hands out an item with no
        // glyph and no action: an empty circle where the sidebar used to be.
        split.displayModeButtonVisibility = .automatic
```

with:

```swift
        // Automatic, and left well alone. A toggle placed BY HAND (fetching
        // `displayModeButtonItem` and putting it in the bar ourselves) is an
        // item with no glyph and no action — the empty circle the iPad showed
        // once. A group of our own beside the automatic toggle is fine; that is
        // how the reader's exit is installed (see PdfInkViewController.exitItem).
        split.displayModeButtonVisibility = .automatic
```

and replace:

```swift
        list.onSelect = { [weak self] link in self?.select(link: link) }
        list.onClose = { [weak self] in self?.closeTapped() }
```

with:

```swift
        list.onSelect = { [weak self] link in self?.select(link: link) }
        // Two doors, one path: both persist first and share the save-failed alert.
        list.onClose = { [weak self] in self?.closeTapped() }
        reader.onCloseSpace = { [weak self] in self?.closeTapped() }
```

Also update the class doc comment's first sentence. Replace:

```swift
 * reader's bar, and a system Close on the list — the one way out, since the
 * reader has no Close of its own. The space owns switching: a cached file loads
```

with:

```swift
 * reader's bar, a system Close on the list and an X in the reader's own bar —
 * two doors into the same `closeTapped()`. The space owns switching: a cached file loads
```

- [ ] **Step 5: Run the full Swift suite**

```bash
cd native/capacitor-pdf-ink && xcodebuild test -scheme ReisCapacitorPdfInk -destination 'platform=iOS Simulator,name=iPad Air 11-inch (M4)' 2>&1 | grep -E "error:|Executed [0-9]+ tests|\*\* TEST"
```

Expected: `Executed 41 tests, with 0 failures` and `** TEST SUCCEEDED **` (39 before, minus 2 deleted, plus 4 new — 3 in `ReaderBarTests` of which 1 pre-existing, 1 new in `SpaceExitTests`; net 41).

- [ ] **Step 6: Sensitivity check — the new exit test must be able to fail**

Comment out the line `reader.onCloseSpace = { [weak self] in self?.closeTapped() }` in `PdfInkSpace.swift`, run:

```bash
cd native/capacitor-pdf-ink && xcodebuild test -scheme ReisCapacitorPdfInk -destination 'platform=iOS Simulator,name=iPad Air 11-inch (M4)' -only-testing:PdfInkPluginTests/SpaceExitTests 2>&1 | grep -E "error:|Test Case|\*\* TEST"
```

Expected: `testTheReadersExitClosesTheSpace … failed` with "the reader's exit did not close the space"; `testTheSidebarsCloseClosesTheSpace` passes. Restore the line. Re-run the same command; expected: both pass. Do not commit with the line commented out — check `git diff` shows the line present.

- [ ] **Step 7: Commit**

```bash
git add native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkViewController.swift native/capacitor-pdf-ink/ios/Sources/PdfInkPlugin/PdfInkSpace.swift native/capacitor-pdf-ink/ios/Tests/PdfInkPluginTests/ReaderScaleTests.swift
git commit -m "feat(pdf ink): an X in the reader's own bar, beside the sidebar toggle

leadingItemGroups adds a group beside the split view's automatic toggle
(proven on the simulator 2026-09-07: glyph draws, action fires, toggle
survives). It lands right of the toggle; accepted. Same closeTapped() as
the sidebar's X, so both doors persist first and share one alert.

The repo said a leading item of ours is a dead empty circle. That is the
HAND-PLACED toggle, not a group; the comment and the test that pinned it
are corrected.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Docs that currently say the opposite

**Files:**
- Modify: `docs/superpowers/specs/2026-09-06-ipad-pdf-ink-verification-checklist.md` (steps 17 and 24)
- Modify: `docs/superpowers/specs/2026-09-06-ipad-pdf-ink-design.md` (the "Addendum 2026-09-07: covering an answer — WITHDRAWN" section, third bullet)

**Interfaces:** none (documentation).

- [ ] **Step 1: Checklist step 17**

Replace:

```markdown
17. [ ] Show the sidebar with Apple's toggle and Close with the X there → back in the drawer;
        reopen the same file → strokes present, sidebar selection on it. That X is the only way
        out: the reader has no Close of its own.
```

with:

```markdown
17. [ ] Close with the X in the reader's bar → back in the drawer; reopen the same file → strokes
        present, sidebar selection on it. Then the other door: show the sidebar with Apple's
        toggle, Close with the X there → the same. Both persist first.
```

- [ ] **Step 2: Checklist step 24**

Replace the whole step 24 (from `24. [ ] The reader's bar carries four buttons and no more` through `brings the sidebar out.`) with:

```markdown
24. [ ] The reader's bar, sidebar hidden: Apple's sidebar toggle on the leading edge, our X
        directly to its RIGHT, then the title; trailing: share, add a page, search, page counter.
        Tap the toggle → the sidebar opens and the toggle moves into the sidebar's own header,
        leaving our X leftmost in the reader's bar. Tap the X in either state → the space
        closes. The toggle is injected by UIKit at render time and cannot be unit-tested, so this
        step is what proves it survived beside our group. If it ever stops working, a swipe from
        the left edge still brings the sidebar out.
```

- [ ] **Step 3: Design addendum**

In `2026-09-06-ipad-pdf-ink-design.md`, replace the bullet beginning `- **Leaving is the sidebar's Close.**` (three lines, ending `known cost and not a surprise.`) with:

```markdown
- **Leaving is either X.** The reader's own Close came back the same day, on
  2026-09-07, installed through `navigationItem.leadingItemGroups` — which UIKit
  adds BESIDE the split view's automatic toggle. The earlier "dead empty circle"
  was a toggle placed by hand, a different thing. Ours lands to the toggle's
  right; accepted. Spec: `2026-09-07-ipad-reader-exit-design.md`.
```

- [ ] **Step 4: Format and commit**

```bash
npx prettier --check docs/superpowers/specs/2026-09-06-ipad-pdf-ink-verification-checklist.md docs/superpowers/specs/2026-09-06-ipad-pdf-ink-design.md
git add docs/superpowers/specs/2026-09-06-ipad-pdf-ink-verification-checklist.md docs/superpowers/specs/2026-09-06-ipad-pdf-ink-design.md
git commit -m "docs(pdf ink): the reader has an exit again; checklist and addendum say so

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Expected from prettier: `All matched files use Prettier code style!` (if not, run `npx prettier --write` on the two files first).

---

### Task 3: Put it on the iPad and run checklist steps 17 and 24

**Files:** none modified. Build artefacts only.

- [ ] **Step 1: Make sure the local plugins are linked**

```bash
ls node_modules/@reis/capacitor-pdf-ink >/dev/null 2>&1 || npm install
```

Expected: no output (linked), or `npm install` completes. Without this `check:native` stops with "declared but not in node_modules" and — because the npm pipeline exits 0 through a pipe — looks like success.

- [ ] **Step 2: Sync the web bundle**

```bash
npm run cap:sync 2>&1 | tail -6
```

Expected: `[info] Sync finished in …` and `@reis/capacitor-pdf-ink@1.0.0` in the "Found 10 Capacitor plugins for ios" list.

- [ ] **Step 3: Build for the cabled iPad**

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'id=00008020-000A7C21368A402E' -derivedDataPath /tmp/reis-pdfink-device-dd -allowProvisioningUpdates DEVELOPMENT_TEAM=RG38V3SV8X build 2>&1 | grep -E "error:|\*\* BUILD" | tail -5
```

Expected: `** BUILD SUCCEEDED **`. (No `.xcworkspace` exists; `DEVELOPMENT_TEAM` is not in the project.)

- [ ] **Step 4: Install and launch**

```bash
xcrun devicectl device install app --device AAB487DD-1610-525F-A8E5-3E29666A8B90 /tmp/reis-pdfink-device-dd/Build/Products/Debug-iphoneos/App.app 2>&1 | grep -E "App installed|error"
xcrun devicectl device process launch --device AAB487DD-1610-525F-A8E5-3E29666A8B90 --terminate-existing cz.reis.app 2>&1 | tail -1
```

Expected: `App installed:` then `Launched application with cz.reis.app bundle identifier.`

- [ ] **Step 5: Hand it over**

Taps cannot be injected on the physical device. Tell Dominik the build is on the iPad and ask him to run checklist steps 17 and 24 (the two doors; the toggle beside the X in both sidebar states). Record his observations in the checklist under those steps before opening the PR.

---

## Self-review

- **Spec coverage:** exit item + `xmark` + `leadingItemGroups` (Task 1 Step 3); `onCloseSpace` restored and wired to `closeTapped()` (Steps 3–4); `.automatic` untouched (Step 4); `setBarItems` leaves the exit alone (Step 3 + `testTheExitWorksWhileNoFileIsLoaded`); no new string (uses `strings.close`); tests replaced/deleted/added exactly as the spec lists, plus the sensitivity check (Step 6); checklist 17/24 and the addendum (Task 2); toggle survival left to the device (Task 3). Comment in `PdfInkSpace` corrected (Step 4). Nothing in the spec is unassigned.
- **Placeholders:** none — every code step shows the code.
- **Type consistency:** `onCloseSpace: (() -> Void)?` in Task 1 Step 3 matches the wiring in Step 4 and the test's use of `exit.target/action`. Test count 41 assumes 39 today; if the suite reports a different baseline, the delta (−2 +4) is what to check, not the absolute.
