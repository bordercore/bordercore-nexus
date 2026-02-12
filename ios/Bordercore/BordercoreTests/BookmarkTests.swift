import XCTest
@testable import Bordercore

final class BookmarkTests: XCTestCase {
    func testDecodesURLWithSchemeAsIs() throws {
        let json = """
        {
          \"uuid\": \"11111111-1111-1111-1111-111111111111\",
          \"name\": \"Example\",
          \"url\": \"https://example.com/page\",
          \"note\": \"note\",
          \"thumbnail_url\": null,
          \"favicon_url\": \"https://example.com/favicon.ico\",
          \"tags\": [\"swift\"],
          \"created\": \"2026-02-12T12:34:56Z\",
          \"is_pinned\": true,
          \"importance\": 2,
          \"video_duration\": null,
          \"last_response_code\": 200
        }
        """

        let bookmark = try XCTUnwrap(decodeBookmark(json))
        XCTAssertEqual(bookmark.url.absoluteString, "https://example.com/page")
        XCTAssertEqual(bookmark.tags, ["swift"])
        XCTAssertEqual(bookmark.lastResponseCode, 200)
    }

    func testDecodesURLWithoutSchemeByAddingHTTPS() throws {
        let json = """
        {
          \"uuid\": \"22222222-2222-2222-2222-222222222222\",
          \"name\": \"No Scheme\",
          \"url\": \"example.com/path\",
          \"note\": null,
          \"thumbnail_url\": null,
          \"favicon_url\": null,
          \"tags\": [],
          \"created\": \"2026-02-12T12:34:56Z\",
          \"is_pinned\": false,
          \"importance\": 1,
          \"video_duration\": null,
          \"last_response_code\": null
        }
        """

        let bookmark = try XCTUnwrap(decodeBookmark(json))
        XCTAssertEqual(bookmark.url.absoluteString, "https://example.com/path")
    }

    func testDecodesCreatedWithFractionalSeconds() throws {
        let json = """
        {
          \"uuid\": \"33333333-3333-3333-3333-333333333333\",
          \"name\": \"Fractional Date\",
          \"url\": \"https://example.com\",
          \"note\": null,
          \"thumbnail_url\": null,
          \"favicon_url\": null,
          \"tags\": [],
          \"created\": \"2026-02-12T12:34:56.123456Z\",
          \"is_pinned\": false,
          \"importance\": 1,
          \"video_duration\": null,
          \"last_response_code\": null
        }
        """

        let bookmark = try XCTUnwrap(decodeBookmark(json))
        XCTAssertNotNil(bookmark.created)
    }

    private func decodeBookmark(_ json: String) -> Bookmark? {
        guard let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(Bookmark.self, from: data)
    }
}
