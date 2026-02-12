import Foundation

struct Bookmark: Identifiable, Codable, Equatable {
    let uuid: UUID
    let name: String
    let url: URL
    let note: String?
    let thumbnailUrl: URL?
    let faviconUrl: String?
    let tags: [String]
    let created: Date
    let isPinned: Bool
    let importance: Int
    let videoDuration: String?
    let lastResponseCode: Int?
    var sortOrder: Int?
    var tagNote: String?

    var id: UUID { uuid }

    enum CodingKeys: String, CodingKey {
        case uuid, name, url, note, tags, created, importance
        case thumbnailUrl = "thumbnail_url"
        case faviconUrl = "favicon_url"
        case isPinned = "is_pinned"
        case videoDuration = "video_duration"
        case lastResponseCode = "last_response_code"
        case sortOrder = "sort_order"
        case tagNote = "tag_note"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        uuid = try container.decode(UUID.self, forKey: .uuid)
        name = try container.decode(String.self, forKey: .name)
        let urlString = try container.decode(String.self, forKey: .url)
        if let parsedURL = URL(string: urlString), parsedURL.scheme != nil {
            url = parsedURL
        } else if let parsedURL = URL(string: "https://\(urlString)") {
            url = parsedURL
        } else {
            throw DecodingError.dataCorruptedError(
                forKey: .url,
                in: container,
                debugDescription: "Invalid bookmark URL: \(urlString)"
            )
        }
        note = try container.decodeIfPresent(String.self, forKey: .note)
        tags = try container.decode([String].self, forKey: .tags)
        isPinned = try container.decode(Bool.self, forKey: .isPinned)
        importance = try container.decode(Int.self, forKey: .importance)
        videoDuration = try container.decodeIfPresent(String.self, forKey: .videoDuration)
        lastResponseCode = try container.decodeIfPresent(Int.self, forKey: .lastResponseCode)
        sortOrder = try container.decodeIfPresent(Int.self, forKey: .sortOrder)
        tagNote = try container.decodeIfPresent(String.self, forKey: .tagNote)

        // Handle thumbnail URL - can be string or null
        if let urlString = try container.decodeIfPresent(String.self, forKey: .thumbnailUrl) {
            thumbnailUrl = URL(string: urlString)
        } else {
            thumbnailUrl = nil
        }

        // Handle favicon URL
        faviconUrl = try container.decodeIfPresent(String.self, forKey: .faviconUrl)

        // Handle date - ISO8601 format from Django
        let dateString = try container.decode(String.self, forKey: .created)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: dateString) {
            created = date
        } else {
            // Try without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            created = formatter.date(from: dateString) ?? Date()
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(uuid, forKey: .uuid)
        try container.encode(name, forKey: .name)
        try container.encode(url, forKey: .url)
        try container.encodeIfPresent(note, forKey: .note)
        try container.encode(tags, forKey: .tags)
        try container.encode(isPinned, forKey: .isPinned)
        try container.encode(importance, forKey: .importance)
        try container.encodeIfPresent(videoDuration, forKey: .videoDuration)
        try container.encodeIfPresent(lastResponseCode, forKey: .lastResponseCode)
        try container.encodeIfPresent(sortOrder, forKey: .sortOrder)
        try container.encodeIfPresent(tagNote, forKey: .tagNote)
        try container.encodeIfPresent(thumbnailUrl?.absoluteString, forKey: .thumbnailUrl)
        try container.encodeIfPresent(faviconUrl, forKey: .faviconUrl)

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        try container.encode(formatter.string(from: created), forKey: .created)
    }
}

// Pagination response wrapper
struct PaginatedResponse<T: Decodable>: Decodable {
    let count: Int
    let next: URL?
    let previous: URL?
    let results: [T]
}
