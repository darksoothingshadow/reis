import PDFKit
import UIKit

/**
 * Find a word in the open file.
 *
 * The thing a student does with a lecture deck they did not write: "where did
 * she define this". Matches are listed with the page they are on and the text
 * around them, because a term worth searching for appears a dozen times and the
 * page number alone does not say which one you want.
 *
 * Diacritic-insensitive on purpose — Czech is typed without accents on a hurry.
 */
@available(iOS 16.0, *)
final class SearchViewController: UIViewController, UISearchBarDelegate, UITableViewDataSource,
    UITableViewDelegate
{
    var onPick: ((PDFSelection) -> Void)?
    var onDismiss: (() -> Void)?

    private let document: PDFDocument
    private let pageWord: String
    private let noMatches: String
    private let searchBar = UISearchBar()
    private let table = UITableView(frame: .zero, style: .plain)
    private let message = UILabel()
    private var matches: [PDFSelection] = []
    private var pending: DispatchWorkItem?

    init(document: PDFDocument, title: String, pageWord: String, noMatches: String) {
        self.document = document
        self.pageWord = pageWord
        self.noMatches = noMatches
        super.init(nibName: nil, bundle: nil)
        self.title = title
    }

    required init?(coder: NSCoder) { fatalError("SearchViewController is code-only") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .close, target: self, action: #selector(closeTapped))

        searchBar.delegate = self
        searchBar.placeholder = title
        searchBar.searchBarStyle = .minimal
        searchBar.autocapitalizationType = .none
        table.dataSource = self
        table.delegate = self
        table.keyboardDismissMode = .onDrag
        message.textAlignment = .center
        message.textColor = .secondaryLabel
        message.isHidden = true
        for view in [searchBar, table, message] {
            view.translatesAutoresizingMaskIntoConstraints = false
            self.view.addSubview(view)
        }
        NSLayoutConstraint.activate([
            searchBar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            searchBar.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 8),
            searchBar.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -8),
            table.topAnchor.constraint(equalTo: searchBar.bottomAnchor),
            table.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            table.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            table.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            message.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            message.topAnchor.constraint(equalTo: table.topAnchor, constant: 40),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        searchBar.becomeFirstResponder()
    }

    func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) {
        // A keystroke at a time would search the whole document on every letter.
        pending?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.search(searchText) }
        pending = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3, execute: work)
    }

    func searchBarSearchButtonClicked(_ searchBar: UISearchBar) {
        pending?.cancel()
        search(searchBar.text ?? "")
        searchBar.resignFirstResponder()
    }

    /**
     * PDFKit's own search, on the main thread: it is a text scan of a file that
     * is already in memory, and a PDFDocument is not documented as thread safe
     * while the reader is drawing from the same one.
     */
    private func search(_ text: String) {
        let query = text.trimmingCharacters(in: .whitespacesAndNewlines)
        matches =
            query.count < 2
            ? []
            : document.findString(query, withOptions: [.caseInsensitive, .diacriticInsensitive])
        message.text = noMatches
        message.isHidden = query.count < 2 || !matches.isEmpty
        table.reloadData()
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        matches.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell =
            tableView.dequeueReusableCell(withIdentifier: "match")
            ?? UITableViewCell(style: .subtitle, reuseIdentifier: "match")
        let match = matches[indexPath.row]
        var content = UIListContentConfiguration.subtitleCell()
        content.text = context(around: match)
        content.textProperties.numberOfLines = 2
        content.secondaryText = pageLabel(for: match)
        cell.contentConfiguration = content
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        onPick?(matches[indexPath.row])
        onDismiss?()
        dismiss(animated: true)
    }

    /// The match plus what surrounds it, so two hits on the same page are told apart.
    private func context(around match: PDFSelection) -> String {
        guard let wider = match.copy() as? PDFSelection else { return match.string ?? "" }
        wider.extend(atStart: 40)
        wider.extend(atEnd: 40)
        let text = (wider.string ?? match.string ?? "")
            .replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespaces)
        return text.isEmpty ? (match.string ?? "") : "…\(text)…"
    }

    private func pageLabel(for match: PDFSelection) -> String {
        guard let page = match.pages.first else { return pageWord }
        return "\(pageWord) \(document.index(for: page) + 1)"
    }

    @objc private func closeTapped() {
        onDismiss?()
        dismiss(animated: true)
    }
}
