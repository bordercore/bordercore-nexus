import Foundation

enum BookmarkShareError: LocalizedError {
    case invalidBaseURL
    case invalidResponse
    case unauthorized
    case server(String)

    var errorDescription: String? {
        switch self {
        case .invalidBaseURL:
            return "Bordercore API URL is invalid."
        case .invalidResponse:
            return "Bordercore returned an invalid response."
        case .unauthorized:
            return "Open Bordercore and sign in, then try sharing again."
        case .server(let message):
            return message
        }
    }
}

struct BookmarkShareAPI {
    private let baseURL: String
    private let session: URLSession

    init(bundle: Bundle = .main, session: URLSession = .shared) {
        let configured = bundle.object(forInfoDictionaryKey: "API_BASE_URL") as? String
        let fallback: String
        #if DEBUG
        fallback = "http://127.0.0.1:8000"
        #else
        fallback = "https://www.bordercore.com"
        #endif
        baseURL = configured?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty ?? fallback
        self.session = session
    }

    func createBookmark(url: URL, title: String?, token: String) async throws {
        guard let endpoint = URL(string: "\(baseURL)/bookmark/api/create/") else {
            throw BookmarkShareError.invalidBaseURL
        }

        let name = title?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty
            ?? url.host(percentEncoded: false)
            ?? url.absoluteString

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("Token \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/x-www-form-urlencoded; charset=utf-8", forHTTPHeaderField: "Content-Type")
        request.httpBody = formBody([
            "url": url.absoluteString,
            "name": name,
            "note": "",
            "tags": "",
            "importance": "false",
            "is_pinned": "false",
            "daily": "false"
        ])

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw BookmarkShareError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return
        case 401:
            throw BookmarkShareError.unauthorized
        case 404:
            throw BookmarkShareError.server("Bordercore could not find the bookmark create endpoint.")
        default:
            let detail = decodeErrorDetail(data, contentType: httpResponse.value(forHTTPHeaderField: "Content-Type"))
                ?? "Could not add bookmark."
            throw BookmarkShareError.server(detail)
        }
    }

    private func formBody(_ values: [String: String]) -> Data? {
        values
            .sorted { $0.key < $1.key }
            .map { "\($0.key.percentEncoded)=\($0.value.percentEncoded)" }
            .joined(separator: "&")
            .data(using: .utf8)
    }

    private func decodeErrorDetail(_ data: Data, contentType: String?) -> String? {
        guard !data.isEmpty else { return nil }
        if let payload = try? JSONDecoder().decode(ErrorPayload.self, from: data) {
            return payload.detail
        }

        if contentType?.localizedCaseInsensitiveContains("text/html") == true {
            return nil
        }

        return String(data: data, encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .nonEmpty
    }

    private struct ErrorPayload: Decodable {
        let detail: String
    }
}

private extension String {
    var nonEmpty: String? {
        isEmpty ? nil : self
    }

    var percentEncoded: String {
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
        return addingPercentEncoding(withAllowedCharacters: allowed) ?? self
    }
}
