import XCTest
@testable import Bordercore

final class PinnedTagTests: XCTestCase {
    func testDecodesPinnedTagFromAPIShape() throws {
        let json = """
        {
          \"name\": \"ios\",
          \"bookmark_count\": 42
        }
        """

        let data = try XCTUnwrap(json.data(using: .utf8))
        let tag = try JSONDecoder().decode(PinnedTag.self, from: data)

        XCTAssertEqual(tag.name, "ios")
        XCTAssertEqual(tag.bookmarkCount, 42)
        XCTAssertEqual(tag.id, "ios")
    }
}
