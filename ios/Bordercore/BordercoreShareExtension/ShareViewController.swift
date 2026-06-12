import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private let statusLabel = UILabel()
    private let detailLabel = UILabel()
    private let doneButton = UIButton(type: .system)
    private let activityIndicator = UIActivityIndicatorView(style: .medium)

    override func viewDidLoad() {
        super.viewDidLoad()
        configureView()
        submitSharedBookmark()
    }

    private func configureView() {
        view.backgroundColor = .systemBackground

        statusLabel.text = "Adding bookmark..."
        statusLabel.font = .preferredFont(forTextStyle: .headline)
        statusLabel.textAlignment = .center

        detailLabel.font = .preferredFont(forTextStyle: .subheadline)
        detailLabel.textColor = .secondaryLabel
        detailLabel.textAlignment = .center
        detailLabel.numberOfLines = 0

        doneButton.setTitle("Done", for: .normal)
        doneButton.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        doneButton.isHidden = true
        doneButton.addTarget(self, action: #selector(doneTapped), for: .touchUpInside)

        activityIndicator.startAnimating()

        let stack = UIStackView(arrangedSubviews: [activityIndicator, statusLabel, detailLabel, doneButton])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }

    private func submitSharedBookmark() {
        Task {
            do {
                let sharedLink = try await extractSharedLink()
                guard let token = SharedKeychain().token() else {
                    throw BookmarkShareError.unauthorized
                }
                try await BookmarkShareAPI().createBookmark(
                    url: sharedLink.url,
                    title: sharedLink.title,
                    token: token
                )
                showCompletion(title: "Bookmark added", detail: sharedLink.url.absoluteString, completesAutomatically: true)
            } catch {
                showCompletion(title: "Could not add bookmark", detail: error.localizedDescription, completesAutomatically: false)
            }
        }
    }

    private func extractSharedLink() async throws -> SharedLink {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            throw SharedLinkError.noURL
        }

        for item in extensionItems {
            let title = item.attributedContentText?.string.nonEmpty
            for provider in item.attachments ?? [] {
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
                   let url = try await loadURL(from: provider) {
                    return SharedLink(url: url, title: title)
                }

                if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
                   let text = try await loadString(from: provider),
                   let url = firstURL(in: text) {
                    return SharedLink(url: url, title: title ?? text.trimmed.nonEmpty)
                }
            }
        }

        throw SharedLinkError.noURL
    }

    private func loadURL(from provider: NSItemProvider) async throws -> URL? {
        try await withCheckedThrowingContinuation { continuation in
            provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { item, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                if let url = item as? URL {
                    continuation.resume(returning: url)
                } else if let data = item as? Data,
                          let text = String(data: data, encoding: .utf8) {
                    continuation.resume(returning: URL(string: text.trimmed))
                } else if let text = item as? String {
                    continuation.resume(returning: URL(string: text.trimmed))
                } else {
                    continuation.resume(returning: nil)
                }
            }
        }
    }

    private func loadString(from provider: NSItemProvider) async throws -> String? {
        try await withCheckedThrowingContinuation { continuation in
            provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { item, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                if let text = item as? String {
                    continuation.resume(returning: text)
                } else if let data = item as? Data {
                    continuation.resume(returning: String(data: data, encoding: .utf8))
                } else {
                    continuation.resume(returning: nil)
                }
            }
        }
    }

    private func firstURL(in text: String) -> URL? {
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        return detector?.firstMatch(in: text, options: [], range: range)?.url
    }

    @MainActor
    private func showCompletion(title: String, detail: String, completesAutomatically: Bool) {
        activityIndicator.stopAnimating()
        statusLabel.text = title
        detailLabel.text = detail
        doneButton.isHidden = completesAutomatically

        if completesAutomatically {
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
                self?.extensionContext?.completeRequest(returningItems: nil)
            }
        }
    }

    @objc private func doneTapped() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}

private struct SharedLink {
    let url: URL
    let title: String?
}

private enum SharedLinkError: LocalizedError {
    case noURL

    var errorDescription: String? {
        "No link was found in the shared item."
    }
}

private extension String {
    var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var nonEmpty: String? {
        isEmpty ? nil : self
    }
}
