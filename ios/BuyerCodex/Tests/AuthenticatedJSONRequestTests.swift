import Foundation
import Testing

@testable import BuyerCodex

final class MockURLProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var requestHandler:
        (@Sendable (URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let handler = Self.requestHandler else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
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

private actor ExpirationRecorder {
    private(set) var count = 0

    func record() {
        count += 1
    }
}

private func makeMockSession() -> URLSession {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MockURLProtocol.self]
    return URLSession(configuration: configuration)
}

@Suite("authenticated request transport", .serialized)
struct AuthenticatedJSONRequestTests {

    @Test("authorizedPOST attaches bearer token")
    func testAuthorizedPostAttachesBearerToken() async throws {
        let session = makeMockSession()
        MockURLProtocol.requestHandler = { request in
            #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer live-token")
            #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: nil
            )!
            return (response, Data("{\"ok\":true}".utf8))
        }

        let authSession = AuthSessionContext(
            accessToken: { "live-token" },
            authState: { .signedIn(user: AuthUser(id: "u1", email: "e", name: "n", role: .buyer)) },
            handleExpiredSession: {}
        )

        let data = try await authorizedPOST(
            baseURL: URL(string: "https://test.local")!,
            path: "/protected",
            body: ["hello": "world"],
            authSession: authSession,
            session: session
        )

        #expect(String(decoding: data, as: UTF8.self) == "{\"ok\":true}")
    }

    @Test("401 response marks the shared session expired")
    func testUnauthorizedResponseInvalidatesSession() async {
        let session = makeMockSession()
        let recorder = ExpirationRecorder()

        MockURLProtocol.requestHandler = { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 401,
                httpVersion: nil,
                headerFields: nil
            )!
            return (response, Data())
        }

        let authSession = AuthSessionContext(
            accessToken: { "expired-token" },
            authState: { .signedIn(user: AuthUser(id: "u1", email: "e", name: "n", role: .buyer)) },
            handleExpiredSession: {
                await recorder.record()
            }
        )

        await #expect(throws: AuthenticatedRequestError.self) {
            _ = try await authorizedPOST(
                baseURL: URL(string: "https://test.local")!,
                path: "/protected",
                body: ["hello": "world"],
                authSession: authSession,
                session: session
            )
        }

        #expect(await recorder.count == 1)
    }
}
