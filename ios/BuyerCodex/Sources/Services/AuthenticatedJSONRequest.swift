import Foundation

enum AuthenticatedRequestError: LocalizedError, Equatable {
    case notAuthenticated
    case invalidResponse
    case httpError(statusCode: Int)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Authentication required."
        case .invalidResponse:
            return "The server returned an invalid response."
        case .httpError(let statusCode):
            return "The server returned HTTP \(statusCode)."
        }
    }
}

func authorizedPOST<T: Encodable>(
    baseURL: URL,
    path: String,
    body: T,
    authSession: AuthSessionContext,
    session: URLSession = .shared
) async throws -> Data {
    guard let token = await authSession.accessToken(), !token.isEmpty else {
        throw AuthenticatedRequestError.notAuthenticated
    }

    var request = URLRequest(url: baseURL.appendingPathComponent(path))
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.httpBody = try JSONEncoder().encode(body)

    let (data, response) = try await session.data(for: request)
    try await validateAuthenticatedResponse(response, authSession: authSession)
    return data
}

private func validateAuthenticatedResponse(
    _ response: URLResponse,
    authSession: AuthSessionContext
) async throws {
    guard let http = response as? HTTPURLResponse else {
        throw AuthenticatedRequestError.invalidResponse
    }
    if http.statusCode == 401 || http.statusCode == 403 {
        await authSession.handleExpiredSession()
        throw AuthenticatedRequestError.notAuthenticated
    }
    guard (200...299).contains(http.statusCode) else {
        throw AuthenticatedRequestError.httpError(statusCode: http.statusCode)
    }
}
