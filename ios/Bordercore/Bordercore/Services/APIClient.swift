import Foundation

/// API error types
enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case notFound
    case loginEndpointNotFound(String)
    case serverError(Int, String?)
    case networkError(Error)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .unauthorized:
            return "Invalid credentials"
        case .notFound:
            return "Resource not found"
        case .loginEndpointNotFound(let baseURL):
            return "Login endpoint not found at \(baseURL). Check API base URL/port."
        case .serverError(let code, let body):
            if let body, !body.isEmpty {
                return "Server error (code: \(code)): \(body)"
            }
            return "Server error (code: \(code))"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Failed to parse response: \(error.localizedDescription)"
        }
    }
}

/// HTTP client for the Bordercore API
actor APIClient {
    static let shared = APIClient()

    private let baseURL: String = {
        if let configuredURL = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String {
            let trimmed = configuredURL.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                return trimmed
            }
        }

        #if DEBUG
        return "http://127.0.0.1:8000"
        #else
        return "https://www.bordercore.com"
        #endif
    }()

    private let session: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        session = URLSession(configuration: config)
    }

    // MARK: - Authentication

    func login(username: String, password: String) async throws -> String {
        for endpoint in ["/api/api-token-auth/", "/api/login/", "/api-token-auth/"] {
            let result = try await attemptLogin(
                endpoint: endpoint,
                username: username,
                password: password
            )
            if let token = result {
                return token
            }
        }
        throw APIError.loginEndpointNotFound(baseURL)
    }

    // MARK: - Generic Request Methods

    func getList<T: Decodable>(_ endpoint: String, token: String) async throws -> [T] {
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Token \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let data = try await performRawRequest(request)

        let decoder = JSONDecoder()
        do {
            return try decoder.decode([T].self, from: data)
        } catch {
            do {
                let paginated = try decoder.decode(PaginatedResponse<T>.self, from: data)
                return paginated.results
            } catch {
                throw APIError.decodingError(error)
            }
        }
    }

    func get<T: Decodable>(_ endpoint: String, token: String) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Token \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let data = try await performRawRequest(request)
        do {
            let decoder = JSONDecoder()
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    func getFromURL<T: Decodable>(_ url: URL, token: String) async throws -> T {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Token \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        return try await performRequest(request)
    }

    func post<T: Decodable, Body: Encodable>(_ endpoint: String, token: String, body: Body) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Token \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        return try await performRequest(request)
    }

    func put<T: Decodable, Body: Encodable>(_ endpoint: String, token: String, body: Body) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("Token \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        return try await performRequest(request)
    }

    func postForm<T: Decodable>(_ endpoint: String, token: String, form: [String: String]) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Token \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/x-www-form-urlencoded; charset=utf-8", forHTTPHeaderField: "Content-Type")

        let body = form
            .sorted { $0.key < $1.key }
            .map { key, value in
                "\(percentEncode(key))=\(percentEncode(value))"
            }
            .joined(separator: "&")
        request.httpBody = body.data(using: .utf8)

        return try await performRequest(request)
    }

    func delete(_ endpoint: String, token: String) async throws {
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Token \(token)", forHTTPHeaderField: "Authorization")

        let data = try await performRawRequest(request)
        if !data.isEmpty {
            _ = String(data: data, encoding: .utf8)
        }
    }

    // MARK: - Private Helpers

    private func attemptLogin(endpoint: String, username: String, password: String) async throws -> String? {
        let url = URL(string: "\(baseURL)\(endpoint)")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["username": username, "password": password]
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.networkError(error)
        }
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200:
            struct TokenResponse: Codable {
                let token: String?
                let key: String?
                let api_key: String?
            }

            let tokenResponse = try JSONDecoder().decode(TokenResponse.self, from: data)
            if let token = tokenResponse.token {
                return token
            }
            if let key = tokenResponse.key {
                return key
            }
            if let apiKey = tokenResponse.api_key {
                return apiKey
            }
            throw APIError.invalidResponse
        case 404:
            return nil
        case 400, 401:
            throw APIError.unauthorized
        default:
            throw APIError.serverError(httpResponse.statusCode, responseBodyString(data))
        }
    }

    private func performRequest<T: Decodable>(_ request: URLRequest) async throws -> T {
        let data = try await performRawRequest(request)
        do {
            let decoder = JSONDecoder()
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    private func performRawRequest(_ request: URLRequest) async throws -> Data {
        let (data, response): (Data, URLResponse)

        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.networkError(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            break
        case 401:
            throw APIError.unauthorized
        case 404:
            throw APIError.notFound
        default:
            throw APIError.serverError(httpResponse.statusCode, responseBodyString(data))
        }
        return data
    }

    private func responseBodyString(_ data: Data) -> String? {
        guard !data.isEmpty else { return nil }
        guard let text = String(data: data, encoding: .utf8) else { return nil }
        let condensed = text.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        return condensed.isEmpty ? nil : String(condensed.prefix(300))
    }

    private func percentEncode(_ value: String) -> String {
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }
}
