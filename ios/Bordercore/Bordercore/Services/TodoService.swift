import Foundation

actor TodoService {
    static let shared = TodoService()

    private init() {}

    func fetchTodos(token: String) async throws -> [TodoItem] {
        try await APIClient.shared.getList("/api/todos/", token: token)
    }

    func createTodo(
        name: String,
        note: String,
        urlString: String,
        tagsCSV: String,
        priority: Int,
        dueDate: Date?,
        token: String
    ) async throws -> TodoItem {
        let cleanedTags = tagsCSV
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
            .filter { !$0.isEmpty }
            .joined(separator: ",")

        let normalizedURL: String?
        let trimmedURL = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedURL.isEmpty {
            normalizedURL = nil
        } else if trimmedURL.lowercased().hasPrefix("http://") || trimmedURL.lowercased().hasPrefix("https://") {
            normalizedURL = trimmedURL
        } else {
            normalizedURL = "https://\(trimmedURL)"
        }

        var form: [String: String] = [
            "name": name,
            "priority": String(priority),
            "tags": cleanedTags
        ]

        let trimmedNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedNote.isEmpty {
            form["note"] = trimmedNote
        }

        if let normalizedURL {
            form["url"] = normalizedURL
        }

        if let dueDate {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "yyyy-MM-dd"
            form["due_date"] = formatter.string(from: dueDate)
        }

        return try await APIClient.shared.postForm("/api/todos/", token: token, form: form)
    }

    func deleteTodo(uuid: UUID, token: String) async throws {
        try await APIClient.shared.delete("/api/todos/\(uuid.uuidString.lowercased())/", token: token)
    }
}
