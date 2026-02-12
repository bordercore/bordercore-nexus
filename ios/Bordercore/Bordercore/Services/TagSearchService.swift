import Foundation

actor TagSearchService {
    static let shared = TagSearchService()

    private struct TagSearchResult: Decodable {
        let label: String?
        let value: String?
        let id: String?
    }

    private init() {}

    func searchTags(query: String, token: String) async throws -> [String] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }

        let encodedQuery = trimmed.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? trimmed
        let endpoint = "/tag/search?query=\(encodedQuery)&doctype=todo&skip_tag_aliases=true"
        let results: [TagSearchResult] = try await APIClient.shared.getList(endpoint, token: token)

        var seen = Set<String>()
        var tags: [String] = []

        for result in results {
            let raw = (result.label ?? result.value ?? result.id ?? "")
            let normalized = raw
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()

            guard !normalized.isEmpty else { continue }
            if seen.insert(normalized).inserted {
                tags.append(normalized)
            }
        }

        return tags
    }
}
