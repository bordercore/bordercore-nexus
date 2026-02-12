import Foundation

/// View state for the bookmark list
enum BookmarkViewState {
    case untagged
    case tag(String)

    var title: String {
        switch self {
        case .untagged:
            return "Untagged"
        case .tag(let name):
            return name
        }
    }
}

/// ViewModel for bookmark list and tag sidebar
@MainActor
final class BookmarkViewModel: ObservableObject {
    @Published var bookmarks: [Bookmark] = []
    @Published var pinnedTags: [PinnedTag] = []
    @Published var viewState: BookmarkViewState = .untagged
    @Published var isLoading = false
    @Published var isRefreshing = false
    @Published var errorMessage: String?

    private let authManager: AuthManager

    init(authManager: AuthManager = .shared) {
        self.authManager = authManager
    }

    // MARK: - Data Loading

    func loadInitialData() async {
        guard let token = authManager.getToken() else { return }

        isLoading = true
        errorMessage = nil

        async let tagsTask = BookmarkService.shared.fetchPinnedTags(token: token)
        async let bookmarksTask = BookmarkService.shared.fetchUntaggedBookmarks(token: token)

        do {
            let (tags, bookmarks) = try await (tagsTask, bookmarksTask)
            self.pinnedTags = tags
            self.bookmarks = bookmarks
        } catch {
            handleError(error)
        }

        isLoading = false
    }

    func refresh() async {
        isRefreshing = true
        await loadBookmarks()
        isRefreshing = false
    }

    func loadBookmarks() async {
        guard let token = authManager.getToken() else { return }

        errorMessage = nil

        do {
            switch viewState {
            case .untagged:
                bookmarks = try await BookmarkService.shared.fetchUntaggedBookmarks(token: token)
            case .tag(let name):
                bookmarks = try await BookmarkService.shared.fetchBookmarksByTag(name, token: token)
            }
        } catch {
            handleError(error)
        }
    }

    func loadPinnedTags() async {
        guard let token = authManager.getToken() else { return }

        do {
            pinnedTags = try await BookmarkService.shared.fetchPinnedTags(token: token)
        } catch {
            handleError(error)
        }
    }

    // MARK: - View State

    func selectUntagged() async {
        viewState = .untagged
        await loadBookmarks()
    }

    func selectTag(_ tag: PinnedTag) async {
        viewState = .tag(tag.name)
        await loadBookmarks()
    }

    // MARK: - Actions

    func deleteBookmark(_ bookmark: Bookmark) async {
        guard let token = authManager.getToken() else { return }

        // Optimistically remove from UI
        let originalBookmarks = bookmarks
        bookmarks.removeAll { $0.uuid == bookmark.uuid }

        do {
            try await BookmarkService.shared.deleteBookmark(uuid: bookmark.uuid, token: token)
            // Refresh tags to update counts
            await loadPinnedTags()
        } catch {
            // Restore on failure
            bookmarks = originalBookmarks
            handleError(error)
        }
    }

    // MARK: - Error Handling

    private func handleError(_ error: Error) {
        if let apiError = error as? APIError {
            errorMessage = apiError.localizedDescription
            if case .unauthorized = apiError {
                authManager.logout()
            }
        } else {
            errorMessage = error.localizedDescription
        }
    }
}
