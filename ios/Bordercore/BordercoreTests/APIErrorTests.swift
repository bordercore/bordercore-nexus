import XCTest
@testable import Bordercore

final class APIErrorTests: XCTestCase {
    func testServerErrorDescriptionIncludesBodyWhenPresent() {
        let error = APIError.serverError(500, "Something broke")
        XCTAssertEqual(error.errorDescription, "Server error (code: 500): Something broke")
    }

    func testServerErrorDescriptionWithoutBody() {
        let error = APIError.serverError(500, nil)
        XCTAssertEqual(error.errorDescription, "Server error (code: 500)")
    }

    func testLoginEndpointNotFoundDescriptionContainsURL() {
        let error = APIError.loginEndpointNotFound("http://localhost:8000")
        XCTAssertTrue(error.errorDescription?.contains("http://localhost:8000") == true)
    }

    func testNetworkErrorDescriptionIncludesUnderlyingMessage() {
        let underlying = NSError(domain: "UnitTest", code: 123, userInfo: [NSLocalizedDescriptionKey: "offline"])
        let error = APIError.networkError(underlying)
        XCTAssertTrue(error.errorDescription?.contains("offline") == true)
    }

    func testDecodingErrorDescriptionIncludesUnderlyingMessage() {
        let decoding = DecodingError.typeMismatch(Int.self, .init(codingPath: [], debugDescription: "bad type"))
        let error = APIError.decodingError(decoding)
        XCTAssertTrue(error.errorDescription?.contains("bad type") == true)
    }
}
