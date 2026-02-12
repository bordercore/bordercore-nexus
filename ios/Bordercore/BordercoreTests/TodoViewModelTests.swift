import XCTest
@testable import Bordercore

@MainActor
final class TodoViewModelTests: XCTestCase {
    func testSelectPriorityFiltersTodos() throws {
        let viewModel = TodoViewModel()
        viewModel.allTodos = [
            try makeTodo(uuid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "High one", priority: 1, tags: ["work"]),
            try makeTodo(uuid: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", name: "Low one", priority: 3, tags: ["home"])
        ]

        viewModel.selectPriority(1)

        XCTAssertEqual(viewModel.viewState, .priority(1))
        XCTAssertEqual(viewModel.todos.count, 1)
        XCTAssertEqual(viewModel.todos.first?.name, "High one")
    }

    func testSelectTagFiltersTodos() throws {
        let viewModel = TodoViewModel()
        viewModel.allTodos = [
            try makeTodo(uuid: "cccccccc-cccc-cccc-cccc-cccccccccccc", name: "Task A", priority: 2, tags: ["ios", "work"]),
            try makeTodo(uuid: "dddddddd-dddd-dddd-dddd-dddddddddddd", name: "Task B", priority: 2, tags: ["personal"])
        ]

        viewModel.selectTag("ios")

        XCTAssertEqual(viewModel.viewState, .tag("ios"))
        XCTAssertEqual(viewModel.todos.count, 1)
        XCTAssertEqual(viewModel.todos.first?.name, "Task A")
    }

    func testSelectAllReturnsAllTodos() throws {
        let viewModel = TodoViewModel()
        viewModel.allTodos = [
            try makeTodo(uuid: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", name: "Task 1", priority: 1, tags: ["one"]),
            try makeTodo(uuid: "ffffffff-ffff-ffff-ffff-ffffffffffff", name: "Task 2", priority: 3, tags: ["two"])
        ]

        viewModel.selectPriority(1)
        XCTAssertEqual(viewModel.todos.count, 1)

        viewModel.selectAll()

        XCTAssertEqual(viewModel.viewState, .all)
        XCTAssertEqual(viewModel.todos.count, 2)
    }

    private func makeTodo(uuid: String, name: String, priority: Int, tags: [String]) throws -> TodoItem {
        let tagsJSON = tags.map { "\"\($0)\"" }.joined(separator: ",")
        let json = """
        {
          \"uuid\": \"\(uuid)\",
          \"name\": \"\(name)\",
          \"note\": null,
          \"tags\": [\(tagsJSON)],
          \"priority\": \(priority),
          \"url\": null,
          \"due_date\": null
        }
        """

        guard let data = json.data(using: .utf8) else {
            throw NSError(domain: "TodoViewModelTests", code: 1)
        }
        return try JSONDecoder().decode(TodoItem.self, from: data)
    }
}
