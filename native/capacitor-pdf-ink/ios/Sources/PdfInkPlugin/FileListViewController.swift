import UIKit

/**
 * The sidebar: the subject's PDFs, Notes-style. A plain sidebar list (name, IS
 * document date, a pencil glyph when ink exists) with a system Close at the top
 * left. Selection and Close are reported to the space; nothing else lives here.
 */
@available(iOS 16.0, *)
final class FileListViewController: UICollectionViewController {
    struct Item: Hashable {
        let link: String
        let name: String
        let date: String
        var hasInk: Bool
    }

    var onSelect: ((String) -> Void)?
    var onClose: (() -> Void)?

    private var items: [Item]
    private var dataSource: UICollectionViewDiffableDataSource<Int, Item>!

    init(title: String, items: [Item]) {
        self.items = items
        let configuration = UICollectionLayoutListConfiguration(appearance: .sidebar)
        super.init(collectionViewLayout: UICollectionViewCompositionalLayout.list(using: configuration))
        self.title = title
        // The default clears the highlight every time the sidebar slides back in.
        clearsSelectionOnViewWillAppear = false
    }

    required init?(coder: NSCoder) { fatalError("FileListViewController is code-only") }

    override func viewDidLoad() {
        super.viewDidLoad()
        // A system item: iOS localises and styles it (a glass X on iOS 26).
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .close, target: self, action: #selector(closeTapped))
        navigationItem.largeTitleDisplayMode = .never

        let registration = UICollectionView.CellRegistration<UICollectionViewListCell, Item> {
            cell, _, item in
            var content = UIListContentConfiguration.sidebarSubtitleCell()
            content.text = item.name
            content.secondaryText = item.date
            cell.contentConfiguration = content
            if item.hasInk {
                let glyph = UIImageView(image: UIImage(systemName: "pencil.tip"))
                glyph.tintColor = .secondaryLabel
                cell.accessories = [
                    .customView(configuration: .init(customView: glyph, placement: .trailing()))
                ]
            } else {
                cell.accessories = []
            }
        }
        dataSource = UICollectionViewDiffableDataSource<Int, Item>(collectionView: collectionView) {
            collectionView, indexPath, item in
            collectionView.dequeueConfiguredReusableCell(using: registration, for: indexPath, item: item)
        }
        applySnapshot()
    }

    private func applySnapshot() {
        var snapshot = NSDiffableDataSourceSnapshot<Int, Item>()
        snapshot.appendSections([0])
        snapshot.appendItems(items)
        dataSource.apply(snapshot, animatingDifferences: false)
    }

    func select(link: String) {
        guard let row = items.firstIndex(where: { $0.link == link }) else { return }
        collectionView.selectItem(
            at: IndexPath(item: row, section: 0), animated: false, scrollPosition: [])
    }

    func setHasInk(link: String, _ hasInk: Bool) {
        guard let row = items.firstIndex(where: { $0.link == link }), items[row].hasInk != hasInk
        else { return }
        let selected = collectionView.indexPathsForSelectedItems ?? []
        items[row].hasInk = hasInk
        applySnapshot()
        for path in selected { collectionView.selectItem(at: path, animated: false, scrollPosition: []) }
    }

    override func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        NSLog("PdfInk: sidebar tapped row \(indexPath.item) \(items[indexPath.item].name)")
        onSelect?(items[indexPath.item].link)
    }

    @objc private func closeTapped() { onClose?() }
}
