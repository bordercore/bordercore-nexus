import Foundation

actor TodoService {
    static let shared = TodoService()

    private struct UpdateTodoPayload: Encodable {
        let name: String
        let note: String?
        let tags: [String]
        let priority: Int
        let url: String?
        let dueDate: String?

        enum CodingKeys: String, CodingKey {
            case name
            case note
            case tags
            case priority
            case url
            case dueDate = "due_date"
        }
    }

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
        let normalized = normalizeFields(name: name, note: note, urlString: urlString, tagsCSV: tagsCSV, dueDate: dueDate)

        var form: [String: String] = [
            "name": normalized.name,
            "priority": String(priority),
            "tags": normalized.tagsCSV
        ]

        if let note = normalized.note {
            form["note"] = note
        }
        if let url = normalized.url {
            form["url"] = url
        }
        if let dueDate = normalized.dueDate {
            form["due_date"] = dueDate
        }

        return try await APIClient.shared.postForm("/api/todos/", token: token, form: form)
    }

    func updateTodo(
        uuid: UUID,
        name: String,
        note: String,
        urlString: String,
        tagsCSV: String,
        priority: Int,
        dueDate: Date?,
        token: String
    ) async throws -> TodoItem {
        let normalized = normalizeFields(name: name, note: note, urlString: urlString, tagsCSV: tagsCSV, dueDate: dueDate)
        let payload = UpdateTodoPayload(
            name: normalized.name,
            note: normalized.note,
            tags: [normalized.tagsCSV],
            priority: priority,
            url: normalized.url,
            dueDate: normalized.dueDate
        )

        return try await APIClient.shared.put(
            "/api/todos/\(uuid.uuidString.lowercased())/",
            token: token,
            body: payload
        )
    }

    func deleteTodo(uuid: UUID, token: String) async throws {
        try await APIClient.shared.delete("/api/todos/\(uuid.uuidString.lowercased())/", token: token)
    }

    private func normalizeFields(
        name: String,
        note: String,
        urlString: String,
        tagsCSV: String,
        dueDate: Date?
    ) -> (name: String, note: String?, url: String?, tagsCSV: String, dueDate: String?) {
        let cleanedName = name.trimmingCharacters(in: .whitespacesAndNewlines)

        let cleanedTags = tagsCSV
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
            .filter { !$0.isEmpty }
            .joined(separator: ",")

        let trimmedNote = note.trimmingCharacters(in: .whitespacesAndNewlines)

        let normalizedURL: String?
        let trimmedURL = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedURL.isEmpty {
            normalizedURL = nil
        } else if trimmedURL.lowercased().hasPrefix("http://") || trimmedURL.lowercased().hasPrefix("https://") {
            normalizedURL = trimmedURL
        } else {
            normalizedURL = "https://\(trimmedURL)"
        }

        let dueDateString: String?
        if let dueDate {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "yyyy-MM-dd"
            dueDateString = formatter.string(from: dueDate)
        } else {
            dueDateString = nil
        }

        return (
            name: cleanedName,
            note: trimmedNote.isEmpty ? nil : trimmedNote,
            url: normalizedURL,
            tagsCSV: cleanedTags,
            dueDate: dueDateString
        )
    }
}
