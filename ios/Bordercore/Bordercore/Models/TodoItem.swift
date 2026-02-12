import Foundation

struct TodoItem: Identifiable, Codable, Equatable {
    let uuid: UUID
    let name: String
    let note: String?
    let tags: [String]
    let priority: Int
    let url: URL?
    let dueDate: Date?

    var id: UUID { uuid }

    enum CodingKeys: String, CodingKey {
        case uuid
        case name
        case note
        case tags
        case priority
        case url
        case dueDate = "due_date"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        uuid = try container.decode(UUID.self, forKey: .uuid)
        name = try container.decode(String.self, forKey: .name)
        note = try container.decodeIfPresent(String.self, forKey: .note)
        tags = try container.decodeIfPresent([String].self, forKey: .tags) ?? []
        priority = try container.decodeIfPresent(Int.self, forKey: .priority) ?? 3

        if let urlString = try container.decodeIfPresent(String.self, forKey: .url),
           !urlString.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            url = URL(string: urlString)
        } else {
            url = nil
        }

        if let dueDateString = try container.decodeIfPresent(String.self, forKey: .dueDate),
           !dueDateString.isEmpty {
            dueDate = TodoItem.parseDate(dueDateString)
        } else {
            dueDate = nil
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(uuid, forKey: .uuid)
        try container.encode(name, forKey: .name)
        try container.encodeIfPresent(note, forKey: .note)
        try container.encode(tags, forKey: .tags)
        try container.encode(priority, forKey: .priority)
        try container.encodeIfPresent(url?.absoluteString, forKey: .url)

        if let dueDate {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            try container.encode(formatter.string(from: dueDate), forKey: .dueDate)
        }
    }

    var priorityName: String {
        switch priority {
        case 1: return "High"
        case 2: return "Medium"
        default: return "Low"
        }
    }

    private static func parseDate(_ value: String) -> Date? {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: value) {
            return date
        }

        iso.formatOptions = [.withInternetDateTime]
        if let date = iso.date(from: value) {
            return date
        }

        let fallback = DateFormatter()
        fallback.locale = Locale(identifier: "en_US_POSIX")
        fallback.dateFormat = "yyyy-MM-dd"
        return fallback.date(from: value)
    }
}

struct TodoTagCount: Identifiable, Equatable {
    let name: String
    let count: Int

    var id: String { name }
}
