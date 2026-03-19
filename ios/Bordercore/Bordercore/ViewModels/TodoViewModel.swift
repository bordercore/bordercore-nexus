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
    private let userDefaults: UserDefaults

    private enum PersistedFilterType: String {
        case all
        case priority
        case tag
    }

    private enum DefaultsKey {
        static let filterType = "todo.filter.type"
        static let filterPriority = "todo.filter.priority"
        static let filterTag = "todo.filter.tag"
    }

    init(authManager: AuthManager = .shared, userDefaults: UserDefaults = .standard) {
        self.authManager = authManager
        self.userDefaults = userDefaults
        self.viewState = restoreViewState()
    }

    func loadInitialData() async {
        isLoading = true
        errorMessage = nil
        await reloadAllTodos()
        switch viewState {
        case .all:
            break
        case .priority, .tag:
            await reloadFilteredTodos(for: viewState)
        }
        isLoading = false
    }

    func refresh() async {
        isRefreshing = true
        switch viewState {
        case .all:
            await reloadAllTodos()
        case .priority, .tag:
            await reloadFilteredTodos(for: viewState)
        }
        isRefreshing = false
    }

    func selectAll() {
        viewState = .all
        persistViewState(.all)
        applyFilter()
        Task {
            await reloadAllTodos()
        }
    }

    func selectPriority(_ priority: Int) {
        viewState = .priority(priority)
        persistViewState(.priority(priority))
        applyFilter()
        Task {
            await reloadFilteredTodos(for: .priority(priority))
        }
    }

    func selectTag(_ tagName: String) {
        viewState = .tag(tagName)
        persistViewState(.tag(tagName))
        applyFilter()
        Task {
            await reloadFilteredTodos(for: .tag(tagName))
        }
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
            _ = try await TodoService.shared.createTodo(
                name: name,
                note: note,
                urlString: urlString,
                tagsCSV: tagsCSV,
                priority: priority,
                dueDate: dueDate,
                token: token
            )

            await reloadAllTodos()
            if case .priority = viewState {
                await reloadFilteredTodos(for: viewState)
            } else if case .tag = viewState {
                await reloadFilteredTodos(for: viewState)
            }
            return nil
        } catch {
            handleError(error)
            return errorMessage ?? "Could not create todo"
        }
    }

    func updateTodo(
        todo: TodoItem,
        name: String,
        note: String,
        urlString: String,
        tagsCSV: String,
        priority: Int,
        dueDate: Date?
    ) async -> String? {
        guard let token = authManager.getToken() else { return "Not authenticated" }

        do {
            _ = try await TodoService.shared.updateTodo(
                uuid: todo.uuid,
                name: name,
                note: note,
                urlString: urlString,
                tagsCSV: tagsCSV,
                priority: priority,
                dueDate: dueDate,
                token: token
            )

            await reloadAllTodos()
            if case .priority = viewState {
                await reloadFilteredTodos(for: viewState)
            } else if case .tag = viewState {
                await reloadFilteredTodos(for: viewState)
            }
            return nil
        } catch {
            handleError(error)
            return errorMessage ?? "Could not update todo"
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
            await reloadAllTodos()
            if case .priority = viewState {
                await reloadFilteredTodos(for: viewState)
            } else if case .tag = viewState {
                await reloadFilteredTodos(for: viewState)
            }
        } catch {
            allTodos = originalAll
            todos = originalFiltered
            handleError(error)
        }
    }

    private func reloadAllTodos() async {
        guard let token = authManager.getToken() else { return }

        do {
            let fetched = try await TodoService.shared.fetchTodos(token: token)
            allTodos = fetched
            recalculateFacets()
            applyFilter()
        } catch {
            handleError(error)
        }
    }

    private func reloadFilteredTodos(for state: TodoViewState) async {
        guard let token = authManager.getToken() else { return }

        do {
            let fetched: [TodoItem]
            switch state {
            case .all:
                fetched = try await TodoService.shared.fetchTodos(token: token)
            case .priority(let priority):
                fetched = try await TodoService.shared.fetchTodos(token: token, priority: priority)
            case .tag(let tagName):
                fetched = try await TodoService.shared.fetchTodos(token: token, tag: tagName)
            }

            if viewState == state {
                todos = fetched
            }
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

    private func persistViewState(_ state: TodoViewState) {
        switch state {
        case .all:
            userDefaults.set(PersistedFilterType.all.rawValue, forKey: DefaultsKey.filterType)
            userDefaults.removeObject(forKey: DefaultsKey.filterPriority)
            userDefaults.removeObject(forKey: DefaultsKey.filterTag)
        case .priority(let value):
            userDefaults.set(PersistedFilterType.priority.rawValue, forKey: DefaultsKey.filterType)
            userDefaults.set(value, forKey: DefaultsKey.filterPriority)
            userDefaults.removeObject(forKey: DefaultsKey.filterTag)
        case .tag(let name):
            userDefaults.set(PersistedFilterType.tag.rawValue, forKey: DefaultsKey.filterType)
            userDefaults.set(name, forKey: DefaultsKey.filterTag)
            userDefaults.removeObject(forKey: DefaultsKey.filterPriority)
        }
    }

    private func restoreViewState() -> TodoViewState {
        guard let rawType = userDefaults.string(forKey: DefaultsKey.filterType),
              let type = PersistedFilterType(rawValue: rawType) else {
            return .all
        }

        switch type {
        case .all:
            return .all
        case .priority:
            let value = userDefaults.integer(forKey: DefaultsKey.filterPriority)
            if [1, 2, 3].contains(value) {
                return .priority(value)
            }
            return .all
        case .tag:
            guard let name = userDefaults.string(forKey: DefaultsKey.filterTag),
                  !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                return .all
            }
            return .tag(name)
        }
    }
}
