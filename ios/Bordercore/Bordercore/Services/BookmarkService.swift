import Foundation

/// Service for bookmark-related API calls
actor BookmarkService {
    static let shared = BookmarkService()

    private init() {}

    // MARK: - Bookmarks

    /// Fetch untagged (bare) bookmarks
    func fetchUntaggedBookmarks(token: String) async throws -> [Bookmark] {
        let response: [Bookmark] = try await APIClient.shared.getList("/api/bookmarks/untagged/", token: token)
        return response
    }

    /// Fetch bookmarks for a specific tag
    func fetchBookmarksByTag(_ tagName: String, token: String) async throws -> [Bookmark] {
        let encodedTag = tagName.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? tagName
        let response: [Bookmark] = try await APIClient.shared.getList("/api/bookmarks/by-tag/\(encodedTag)/", token: token)
        return response
    }

    /// Delete a bookmark by UUID
    func deleteBookmark(uuid: UUID, token: String) async throws {
        try await APIClient.shared.delete("/api/bookmarks/\(uuid.uuidString.lowercased())/", token: token)
    }

    // MARK: - Tags

    /// Fetch pinned tags with bookmark counts
    func fetchPinnedTags(token: String) async throws -> [PinnedTag] {
        let response: [PinnedTag] = try await APIClient.shared.getList("/api/tags/pinned/", token: token)
        return response
    }
}
