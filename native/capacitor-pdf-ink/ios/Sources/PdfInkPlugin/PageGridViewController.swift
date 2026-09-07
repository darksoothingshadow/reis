import PDFKit
import UIKit

/**
 * The pages of the open file as thumbnails, so a lecture deck is navigable
 * without scrolling through it.
 *
 * A SHEET rather than a strip down the edge of the page: an edge scrubber sits
 * exactly where a right-handed student rests their palm, and every iPad PDF app
 * that has one collects the same complaint — the hand brushes it and the reader
 * jumps somewhere else mid-sentence. A sheet cannot be hit by accident.
 *
 * Thumbnails are drawn for the cells that are on screen and kept, so opening the
 * sheet on a 200-page file costs the dozen pages you can see, not two hundred.
 */
@available(iOS 16.0, *)
final class PageGridViewController: UICollectionViewController {
    var onPick: ((Int) -> Void)?
    /// Called for every way out of the sheet that the sheet itself knows about;
    /// a swipe down is the presenting controller's to notice.
    var onDismiss: (() -> Void)?
    /// Answers whether the page went away, so the grid knows to redraw itself.
    var onRemove: ((Int) -> Bool)?

    private let document: PDFDocument
    private let inked: (Int) -> Bool
    private let added: (Int) -> Bool
    private let strings: PdfInkStrings
    private var current: Int
    private var thumbnails: [Int: UIImage] = [:]

    init(
        document: PDFDocument, title: String, current: Int, strings: PdfInkStrings,
        inked: @escaping (Int) -> Bool, added: @escaping (Int) -> Bool
    ) {
        self.document = document
        self.inked = inked
        self.added = added
        self.strings = strings
        self.current = current
        // A third of the ROW each, not of the group: an item sized to the full
        // width lays three pages on top of one another and shows one.
        let columns = 3
        let item = NSCollectionLayoutItem(
            layoutSize: .init(
                widthDimension: .fractionalWidth(1 / CGFloat(columns)),
                heightDimension: .fractionalHeight(1)))
        item.contentInsets = .init(top: 8, leading: 8, bottom: 8, trailing: 8)
        let group = NSCollectionLayoutGroup.horizontal(
            layoutSize: .init(
                widthDimension: .fractionalWidth(1), heightDimension: .absolute(220)),
            repeatingSubitem: item, count: columns)
        super.init(collectionViewLayout: UICollectionViewCompositionalLayout(section: .init(group: group)))
        self.title = title
    }

    required init?(coder: NSCoder) { fatalError("PageGridViewController is code-only") }

    override func viewDidLoad() {
        super.viewDidLoad()
        collectionView.backgroundColor = .systemBackground
        collectionView.register(PageCell.self, forCellWithReuseIdentifier: PageCell.id)
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .close, target: self, action: #selector(closeTapped))
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard current < document.pageCount else { return }
        collectionView.scrollToItem(
            at: IndexPath(item: current, section: 0), at: .centeredVertically, animated: false)
    }

    override func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        document.pageCount
    }

    override func collectionView(
        _ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath
    ) -> UICollectionViewCell {
        let cell =
            collectionView.dequeueReusableCell(withReuseIdentifier: PageCell.id, for: indexPath)
            as! PageCell
        let index = indexPath.item
        cell.show(
            number: index + 1, thumbnail: thumbnail(for: index), hasInk: inked(index),
            isCurrent: index == current)
        return cell
    }

    override func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        NSLog("PdfInk: page grid picked \(indexPath.item)")
        onPick?(indexPath.item)
        onDismiss?()
        dismiss(animated: true)
    }

    /**
     * Long press a page the student added to take it away again — the
     * counterpart of "+", and where GoodNotes and Notes put page actions too.
     * Pages of the teacher's file have no such menu: the PDF is never rewritten,
     * so removing one could not survive the next open.
     */
    override func collectionView(
        _ collectionView: UICollectionView,
        contextMenuConfigurationForItemAt indexPath: IndexPath, point: CGPoint
    ) -> UIContextMenuConfiguration? {
        let index = indexPath.item
        guard added(index), document.pageCount > 1 else { return nil }
        return UIContextMenuConfiguration(identifier: nil, previewProvider: nil) { [weak self] _ in
            guard let self else { return nil }
            let remove = UIAction(
                title: strings.removePage, image: UIImage(systemName: "trash"),
                attributes: .destructive
            ) { [weak self] _ in self?.confirmRemove(index) }
            return UIMenu(children: [remove])
        }
    }

    /// Asking only when there is something to lose: an empty page the student
    /// just added is not worth a dialog, ink on it is.
    private func confirmRemove(_ index: Int) {
        guard inked(index) else {
            remove(index)
            return
        }
        let alert = UIAlertController(
            title: strings.removePage, message: nil, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: strings.cancel, style: .cancel))
        alert.addAction(
            UIAlertAction(title: strings.removePage, style: .destructive) { [weak self] _ in
                self?.remove(index)
            })
        present(alert, animated: true)
    }

    private func remove(_ index: Int) {
        guard onRemove?(index) == true else { return }
        // Every page after it has a new number, so no cached picture is trustworthy.
        thumbnails.removeAll()
        // Where the reader goes, not where the grid was: `removeAddedPage`
        // lands on min(index, last), and a grid still pointing at its old row
        // highlights a page nobody is looking at.
        current = min(index, document.pageCount - 1)
        collectionView.reloadData()
    }

    private func thumbnail(for index: Int) -> UIImage? {
        if let cached = thumbnails[index] { return cached }
        guard let page = document.page(at: index) else { return nil }
        // On the main thread on purpose: PDFDocument is not documented as thread
        // safe and the reader is drawing from the same one. A 120pt thumbnail is
        // cheap, and only the visible cells ask.
        let image = page.thumbnail(of: CGSize(width: 120, height: 170), for: .cropBox)
        thumbnails[index] = image
        return image
    }

    @objc private func closeTapped() {
        onDismiss?()
        dismiss(animated: true)
    }
}

@available(iOS 16.0, *)
private final class PageCell: UICollectionViewCell {
    static let id = "page"

    private let thumbnail = UIImageView()
    private let number = UILabel()
    private let mark = UIImageView(image: UIImage(systemName: "pencil.tip"))

    override init(frame: CGRect) {
        super.init(frame: frame)
        thumbnail.contentMode = .scaleAspectFit
        thumbnail.backgroundColor = .secondarySystemBackground
        thumbnail.layer.borderWidth = 1
        thumbnail.layer.cornerRadius = 4
        number.font = .preferredFont(forTextStyle: .caption1)
        number.textAlignment = .center
        mark.tintColor = .secondaryLabel
        for view in [thumbnail, number, mark] {
            view.translatesAutoresizingMaskIntoConstraints = false
            contentView.addSubview(view)
        }
        NSLayoutConstraint.activate([
            thumbnail.topAnchor.constraint(equalTo: contentView.topAnchor),
            thumbnail.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            thumbnail.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            thumbnail.bottomAnchor.constraint(equalTo: number.topAnchor, constant: -4),
            number.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            number.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            number.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
            mark.trailingAnchor.constraint(equalTo: thumbnail.trailingAnchor, constant: -6),
            mark.bottomAnchor.constraint(equalTo: thumbnail.bottomAnchor, constant: -6),
        ])
    }

    required init?(coder: NSCoder) { fatalError("PageCell is code-only") }

    func show(number pageNumber: Int, thumbnail image: UIImage?, hasInk: Bool, isCurrent: Bool) {
        thumbnail.image = image
        number.text = "\(pageNumber)"
        number.textColor = isCurrent ? .tintColor : .secondaryLabel
        thumbnail.layer.borderColor =
            isCurrent ? UIColor.tintColor.cgColor : UIColor.separator.cgColor
        thumbnail.layer.borderWidth = isCurrent ? 2 : 1
        mark.isHidden = !hasInk
        isAccessibilityElement = true
        accessibilityLabel = "\(pageNumber)"
    }
}
