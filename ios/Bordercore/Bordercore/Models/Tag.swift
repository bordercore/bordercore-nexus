import Foundation

struct PinnedTag: Identifiable, Codable, Equatable {
    let name: String
    let bookmarkCount: Int

    var id: String { name }

    enum CodingKeys: String, CodingKey {
        case name
        case bookmarkCount = "bookmark_count"
    }
}
