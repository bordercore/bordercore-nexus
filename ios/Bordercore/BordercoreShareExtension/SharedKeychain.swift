import Foundation
import Security

struct SharedKeychain {
    private let service = "com.bordercore.app"
    private let account = "auth_token"
    private let accessGroup: String

    init(bundle: Bundle = .main) {
        let prefix = bundle.object(forInfoDictionaryKey: "AppIdentifierPrefix") as? String ?? ""
        accessGroup = "\(prefix)com.bordercore.app"
    }

    func token() -> String? {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true
        ]
        query[kSecAttrAccessGroup as String] = accessGroup

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess,
              let data = result as? Data,
              let token = String(data: data, encoding: .utf8) else {
            return nil
        }
        return token
    }
}
