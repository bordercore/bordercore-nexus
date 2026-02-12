import Foundation

enum TodoViewState: Equatable {
    case all
    case priority(Int)
    case tag(String)

    var title: String {
        switch self {
        case .all:
            return "Todo"
        case .priority(let value):
            switch value {
            case 1: return "High Priority"
            case 2: return "Medium Priority"
            default: return "Low Priority"
            }
        case .tag(let name):
            return "#\(name)"
        }
    }
}

@MainActor
final class TodoViewModel: ObservableObject {
    @Published var allTodos: [TodoItem] = []
    @Published var todos: [TodoItem] = []
    @Published var tagCounts: [TodoTagCount] = []
    @Published var priorityCounts: [Int: Int] = [:]
    @Published var viewState: TodoViewState = .all
    @Published var isLoading = false
    @Published var isRefreshing = false
    @Published var errorMessage: String?

    private let authManager: AuthManager

    init(authManager: AuthManager = .shared) {
        self.authManager = authManager
    }

    func loadInitialData() async {
        isLoading = true
        errorMessage = nil
        await reloadTodos()
        isLoading = false
    }

    func refresh() async {
        isRefreshing = true
        await reloadTodos()
        isRefreshing = false
    }

    func selectAll() {
        viewState = .all
        applyFilter()
    }

    func selectPriority(_ priority: Int) {
        viewState = .priority(priority)
        applyFilter()
    }

    func selectTag(_ tagName: String) {
        viewState = .tag(tagName)
        applyFilter()
    }

    func createTodo(
        name: String,
        note: String,
        urlString: String,
        tagsCSV: String,
        priority: Int,
        dueDate: Date?
    ) async -> String? {
        guard let token = authManager.getToken() else { return "Not authenticated" }

        do {
            let created = try await TodoService.shared.createTodo(
                name: name,
                note: note,
                urlString: urlString,
                tagsCSV: tagsCSV,
                priority: priority,
                dueDate: dueDate,
                token: token
            )
            allTodos.append(created)
            allTodos.sort { lhs, rhs in
                lhs.priority < rhs.priority
            }
            recalculateFacets()
            applyFilter()
            return nil
        } catch {
            handleError(error)
            return errorMessage ?? "Could not create todo"
        }
    }

    func deleteTodo(_ todo: TodoItem) async {
        guard let token = authManager.getToken() else { return }

        let originalAll = allTodos
        let originalFiltered = todos

        allTodos.removeAll { $0.uuid == todo.uuid }
        applyFilter()

        do {
            try await TodoService.shared.deleteTodo(uuid: todo.uuid, token: token)
            recalculateFacets()
        } catch {
            allTodos = originalAll
            todos = originalFiltered
            handleError(error)
        }
    }

    private func reloadTodos() async {
        guard let token = authManager.getToken() else { return }

        do {
            let fetched = try await TodoService.shared.fetchTodos(token: token)
            allTodos = fetched.sorted { lhs, rhs in
                lhs.priority < rhs.priority
            }
            recalculateFacets()
            applyFilter()
        } catch {
            handleError(error)
        }
    }

    private func recalculateFacets() {
        var tags: [String: Int] = [:]
        var priorities: [Int: Int] = [1: 0, 2: 0, 3: 0]

        for todo in allTodos {
            priorities[todo.priority, default: 0] += 1
            for tag in todo.tags {
                tags[tag, default: 0] += 1
            }
        }

        priorityCounts = priorities
        tagCounts = tags
            .map { TodoTagCount(name: $0.key, count: $0.value) }
            .sorted { lhs, rhs in
                if lhs.count == rhs.count {
                    return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
                }
                return lhs.count > rhs.count
            }
    }

    private func applyFilter() {
        switch viewState {
        case .all:
            todos = allTodos
        case .priority(let priority):
            todos = allTodos.filter { $0.priority == priority }
        case .tag(let tagName):
            todos = allTodos.filter { $0.tags.contains(tagName) }
        }
    }

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
