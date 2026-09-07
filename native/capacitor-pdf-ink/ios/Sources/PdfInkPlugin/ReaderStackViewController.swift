import UIKit

/**
 * A gesture that never fires and never interferes: it only reports that a touch
 * began, which is how the space learns which half the student is working in.
 * A tap recogniser would miss the start of a stroke, and a stroke is exactly the
 * moment focus should move.
 */
final class TouchObserver: UIGestureRecognizer {
    private let onTouch: () -> Void

    init(onTouch: @escaping () -> Void) {
        self.onTouch = onTouch
        super.init(target: nil, action: nil)
        cancelsTouchesInView = false
        delaysTouchesBegan = false
        delaysTouchesEnded = false
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        onTouch()
        state = .failed
    }
}

/**
 * The right-hand side of the space: one reader, or two side by side with a hair
 * line between them.
 *
 * It owns nothing about files — it lays the halves out, says which one was last
 * touched, and says how wide it is so the space can tell whether there is room
 * for two.
 */
@available(iOS 16.0, *)
final class ReaderStackViewController: UIViewController {
    var onFocus: ((Int) -> Void)?
    var onWidthChanged: ((CGFloat) -> Void)?

    private let stack = UIStackView()
    private var reportedWidth: CGFloat = 0

    override func viewDidLoad() {
        super.viewDidLoad()
        stack.axis = .horizontal
        stack.distribution = .fillEqually
        stack.spacing = 1
        stack.backgroundColor = .separator
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.backgroundColor = .systemBackground
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.topAnchor),
            stack.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let width = view.bounds.width
        guard width > 0, width != reportedWidth else { return }
        reportedWidth = width
        // Out of the layout pass: the space answers a width change by adding or
        // removing a half, and that is a change to the hierarchy being laid out.
        DispatchQueue.main.async { [onWidthChanged] in onWidthChanged?(width) }
    }

    func setPanes(_ panes: [UIViewController]) {
        loadViewIfNeeded()
        for child in children where !panes.contains(child) {
            child.willMove(toParent: nil)
            child.view.removeFromSuperview()
            child.removeFromParent()
        }
        for (index, pane) in panes.enumerated() {
            if pane.parent !== self {
                addChild(pane)
                pane.view.addGestureRecognizer(
                    TouchObserver { [weak self] in self?.focusChanged(to: pane) })
            }
            stack.insertArrangedSubview(pane.view, at: index)
            if pane.parent === self { pane.didMove(toParent: self) }
        }
    }

    /// Asked by identity, so a half that has moved sides still reports its own index.
    private func focusChanged(to pane: UIViewController) {
        guard let index = stack.arrangedSubviews.firstIndex(of: pane.view) else { return }
        onFocus?(index)
    }
}
