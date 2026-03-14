import XCTest
@testable import Bordercore

final class APIClientPaginationTests: XCTestCase {
    private let token = "test-token"

    override func setUp() {
        super.setUp()
        MockURLProtocol.requestHandler = nil
    }

    override func tearDown() {
        MockURLProtocol.requestHandler = nil
        super.tearDown()
    }

    func testGetAllPaginatedListReturnsSinglePageResults() async throws {
        let baseURL = "https://example.com"
        let firstPageURL = URL(string: "\(baseURL)/api/todos/")!

        MockURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.url, firstPageURL)
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Token test-token")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Accept"), "application/json")

            let json = """
            {
              "count": 2,
              "next": null,
              "previous": null,
              "results": [
                { "id": 1 },
                { "id": 2 }
              ]
            }
            """

            return (
                HTTPURLResponse(url: firstPageURL, statusCode: 200, httpVersion: nil, headerFields: nil)!,
                Data(json.utf8)
            )
        }

        let client = makeClient(baseURL: baseURL)
        let items: [TestItem] = try await client.getAllPaginatedList("/api/todos/", token: token)

        XCTAssertEqual(items.map(\.id), [1, 2])
    }

    func testGetAllPaginatedListFollowsNextAcrossMultiplePages() async throws {
        let baseURL = "https://example.com"
        let firstPageURL = URL(string: "\(baseURL)/api/todos/")!
        let secondPageURL = URL(string: "\(baseURL)/api/todos/?limit=20&offset=20")!

        MockURLProtocol.requestHandler = { request in
            guard let url = request.url else {
                throw APIError.invalidURL
            }

            if url == firstPageURL {
                let json = """
                {
                  "count": 3,
                  "next": "\(secondPageURL.absoluteString)",
                  "previous": null,
                  "results": [
                    { "id": 1 },
                    { "id": 2 }
                  ]
                }
                """
                return (
                    HTTPURLResponse(url: firstPageURL, statusCode: 200, httpVersion: nil, headerFields: nil)!,
                    Data(json.utf8)
                )
            }

            if url == secondPageURL {
                let json = """
                {
                  "count": 3,
                  "next": null,
                  "previous": "\(firstPageURL.absoluteString)",
                  "results": [
                    { "id": 3 }
                  ]
                }
                """
                return (
                    HTTPURLResponse(url: secondPageURL, statusCode: 200, httpVersion: nil, headerFields: nil)!,
                    Data(json.utf8)
                )
            }

            XCTFail("Unexpected URL: \(url.absoluteString)")
            throw APIError.invalidURL
        }

        let client = makeClient(baseURL: baseURL)
        let items: [TestItem] = try await client.getAllPaginatedList("/api/todos/", token: token)

        XCTAssertEqual(items.map(\.id), [1, 2, 3])
    }

    func testGetAllPaginatedListReturnsArrayResponseUnchanged() async throws {
        let baseURL = "https://example.com"
        let firstPageURL = URL(string: "\(baseURL)/api/todos/")!

        MockURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.url, firstPageURL)
            let json = """
            [
              { "id": 10 },
              { "id": 11 }
            ]
            """
            return (
                HTTPURLResponse(url: firstPageURL, statusCode: 200, httpVersion: nil, headerFields: nil)!,
                Data(json.utf8)
            )
        }

        let client = makeClient(baseURL: baseURL)
        let items: [TestItem] = try await client.getAllPaginatedList("/api/todos/", token: token)

        XCTAssertEqual(items.map(\.id), [10, 11])
    }

    func testGetAllPaginatedListBubblesMidPaginationUnauthorized() async throws {
        let baseURL = "https://example.com"
        let firstPageURL = URL(string: "\(baseURL)/api/todos/")!
        let secondPageURL = URL(string: "\(baseURL)/api/todos/?limit=20&offset=20")!

        MockURLProtocol.requestHandler = { request in
            guard let url = request.url else {
                throw APIError.invalidURL
            }

            if url == firstPageURL {
                let json = """
                {
                  "count": 3,
                  "next": "\(secondPageURL.absoluteString)",
                  "previous": null,
                  "results": [
                    { "id": 1 },
                    { "id": 2 }
                  ]
                }
                """
                return (
                    HTTPURLResponse(url: firstPageURL, statusCode: 200, httpVersion: nil, headerFields: nil)!,
                    Data(json.utf8)
                )
            }

            if url == secondPageURL {
                return (
                    HTTPURLResponse(url: secondPageURL, statusCode: 401, httpVersion: nil, headerFields: nil)!,
                    Data()
                )
            }

            XCTFail("Unexpected URL: \(url.absoluteString)")
            throw APIError.invalidURL
        }

        let client = makeClient(baseURL: baseURL)

        do {
            let _: [TestItem] = try await client.getAllPaginatedList("/api/todos/", token: token)
            XCTFail("Expected unauthorized error")
        } catch let error as APIError {
            guard case .unauthorized = error else {
                XCTFail("Expected unauthorized error, got \(error)")
                return
            }
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testPostWithoutResponseBodyAcceptsCreatedStatus() async throws {
        let baseURL = "https://example.com"
        let postURL = URL(string: "\(baseURL)/api/fitness/exercise/123/workouts/")!

        MockURLProtocol.requestHandler = { request in
            XCTAssertEqual(request.url, postURL)
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Token test-token")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Accept"), "application/json")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
            XCTAssertEqual(request.httpBody, Data("{\"sets\":[]}".utf8))

            return (
                HTTPURLResponse(url: postURL, statusCode: 201, httpVersion: nil, headerFields: nil)!,
                Data()
            )
        }

        let client = makeClient(baseURL: baseURL)
        try await client.post("/api/fitness/exercise/123/workouts/", token: token, body: EmptySetsPayload())
    }

    private func makeClient(baseURL: String) -> APIClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockURLProtocol.self]
        let session = URLSession(configuration: configuration)
        return APIClient(baseURL: baseURL, session: session)
    }
}

private struct TestItem: Decodable, Equatable {
    let id: Int
}

private struct EmptySetsPayload: Encodable {
    let sets: [Int] = []
}

private final class MockURLProtocol: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let handler = MockURLProtocol.requestHandler else {
            XCTFail("Missing request handler")
            return
        }

        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}
