import XCTest
@testable import Bordercore

final class TodoItemTests: XCTestCase {
    func testDecodesDueDateInISOFormat() throws {
        let json = """
        {
          \"uuid\": \"11111111-1111-1111-1111-111111111111\",
          \"name\": \"Buy milk\",
          \"note\": \"2%\",
          \"tags\": [\"errands\", \"home\"],
          \"priority\": 2,
          \"url\": \"https://example.com\",
          \"due_date\": \"2026-02-12T18:30:00Z\"
        }
        """

        let todo = try XCTUnwrap(decodeTodo(from: json))

        XCTAssertEqual(todo.name, "Buy milk")
        XCTAssertEqual(todo.priority, 2)
        XCTAssertEqual(todo.priorityName, "Medium")
        XCTAssertEqual(todo.tags, ["errands", "home"])
        XCTAssertNotNil(todo.dueDate)
    }

    func testDecodesDueDateInYYYYMMDDFormat() throws {
        let json = """
        {
          \"uuid\": \"22222222-2222-2222-2222-222222222222\",
          \"name\": \"Prepare taxes\",
          \"tags\": [\"finance\"],
          \"priority\": 1,
          \"due_date\": \"2026-04-15\"
        }
        """

        let todo = try XCTUnwrap(decodeTodo(from: json))

        XCTAssertEqual(todo.priorityName, "High")
        XCTAssertNotNil(todo.dueDate)
    }

    func testDefaultsToLowPriorityNameForUnknownValue() throws {
        let json = """
        {
          \"uuid\": \"33333333-3333-3333-3333-333333333333\",
          \"name\": \"Loose task\",
          \"tags\": [],
          \"priority\": 99
        }
        """

        let todo = try XCTUnwrap(decodeTodo(from: json))
        XCTAssertEqual(todo.priorityName, "Low")
    }

    private func decodeTodo(from json: String) -> TodoItem? {
        guard let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(TodoItem.self, from: data)
    }
}
