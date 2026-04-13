import Foundation
import Observation

// MARK: - DealTrackerState

enum DealTrackerState: Sendable, Equatable {
    case loading
    case noDeal
    case activeDeal(DealSummary)
    case error(String)
}

// MARK: - DealProvider Protocol

protocol DealProvider: Sendable {
    func fetchDeals(for userId: String) async throws -> [DealSummary]
}

// MARK: - ConvexDealProvider

final class ConvexDealProvider: DealProvider, Sendable {

    private let baseURL: URL
    private let authSession: AuthSessionContext
    private let session: URLSession

    init(
        baseURL: URL = URL(string: "https://api.buyerv2.com")!,
        authSession: AuthSessionContext = .unavailable,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.authSession = authSession
        self.session = session
    }

    func fetchDeals(for userId: String) async throws -> [DealSummary] {
        let body: [String: String] = ["userId": userId]
        let data = try await authorizedPOST(
            baseURL: baseURL,
            path: "/deals/list",
            body: body,
            authSession: authSession,
            session: session
        )
        return try JSONDecoder().decode([DealSummary].self, from: data)
    }
}

// MARK: - DealServiceError

enum DealServiceError: Error {
    case invalidResponse
    case httpError(statusCode: Int)
    case noUserId
}

// MARK: - DealService

@MainActor
@Observable
final class DealService {

    private(set) var state: DealTrackerState = .loading
    private(set) var deals: [DealSummary] = []

    var activeDeal: DealSummary? {
        deals.first { $0.status.isActive }
    }

    private let provider: DealProvider
    private var currentUserId: String?

    init(provider: DealProvider = ConvexDealProvider()) {
        self.provider = provider
    }

    // MARK: - Public

    func loadDeals(for userId: String) async {
        currentUserId = userId
        state = .loading

        do {
            let fetched = try await provider.fetchDeals(for: userId)
            deals = fetched

            if let active = fetched.first(where: { $0.status.isActive }) {
                state = .activeDeal(active)
            } else {
                state = .noDeal
            }
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    func refresh() async {
        guard let userId = currentUserId else {
            state = .error("No user ID available")
            return
        }
        await loadDeals(for: userId)
    }
}
