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

    /// Create an untagged bookmark from a shared URL
    func createBookmark(url: URL, title: String?, token: String) async throws {
        let body = CreateBookmarkRequest(
            url: url.absoluteString,
            name: title?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty
                ?? url.host(percentEncoded: false)
                ?? url.absoluteString,
            note: "",
            tags: "",
            importance: "false",
            isPinned: "false",
            daily: "false"
        )
        let _: CreateBookmarkResponse = try await APIClient.shared.postForm(
            "/bookmark/api/create/",
            token: token,
            form: body.form
        )
    }

    // MARK: - Tags

    /// Fetch pinned tags with bookmark counts
    func fetchPinnedTags(token: String) async throws -> [PinnedTag] {
        let response: [PinnedTag] = try await APIClient.shared.getList("/api/tags/pinned/", token: token)
        return response
    }
}

private struct CreateBookmarkRequest {
    let url: String
    let name: String
    let note: String
    let tags: String
    let importance: String
    let isPinned: String
    let daily: String

    var form: [String: String] {
        [
            "url": url,
            "name": name,
            "note": note,
            "tags": tags,
            "importance": importance,
            "is_pinned": isPinned,
            "daily": daily
        ]
    }
}

private struct CreateBookmarkResponse: Decodable {
    let uuid: UUID
    let url: String
    let name: String
}

private extension String {
    var nonEmpty: String? {
        isEmpty ? nil : self
    }
}
