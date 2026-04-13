import Foundation

typealias AccessTokenProvider = @Sendable () async -> String?
typealias AuthStateProvider = @Sendable () async -> AuthState
typealias SessionExpirationHandler = @Sendable () async -> Void

/// Stable auth/session boundary shared by the app shell and any
/// authenticated backend adapters. The rest of the iOS surface stays
/// provider-agnostic and only depends on this contract.
struct AuthSessionContext: Sendable {
    let accessToken: AccessTokenProvider
    let authState: AuthStateProvider
    let handleExpiredSession: SessionExpirationHandler

    static let unavailable = AuthSessionContext(
        accessToken: { nil },
        authState: { .authUnavailable },
        handleExpiredSession: {}
    )
}
