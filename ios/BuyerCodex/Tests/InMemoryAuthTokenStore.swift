import Foundation

@testable import BuyerCodex

actor InMemoryAuthTokenStore: AuthTokenStore {
    private var storage: [String: Data] = [:]

    func save(key: String, data: Data) throws {
        storage[key] = data
    }

    func load(key: String) throws -> Data? {
        storage[key]
    }

    func delete(key: String) throws {
        storage.removeValue(forKey: key)
    }
}
