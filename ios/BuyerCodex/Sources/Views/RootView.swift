import SwiftUI

struct RootView: View {

    @Environment(AuthService.self) private var authService

    var body: some View {
        Group {
            switch authService.state {
            case .restoring:
                restoringView(
                    title: "Restoring Session…",
                    subtitle: "Checking your saved credentials."
                )
            case .signedOut:
                SignInView()
            case .signedIn(let user):
                ContentView(user: user, authSession: authService.sessionContext)
            case .expired:
                expiredSessionView
            case .authUnavailable:
                authUnavailableView
            }
        }
        .animation(.easeInOut(duration: 0.3), value: authService.state)
    }

    // MARK: - Restoring

    private func restoringView(title: String, subtitle: String) -> some View {
        VStack(spacing: 20) {
            Image(systemName: "house.fill")
                .font(.system(size: 56))
                .foregroundStyle(Color(hex: 0x1B2B65))
            ProgressView()
                .controlSize(.large)
            Text(title)
                .font(.headline)
                .foregroundStyle(Color(hex: 0x1B2B65))
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }

    private var expiredSessionView: some View {
        VStack(spacing: 20) {
            Image(systemName: "clock.arrow.circlepath")
                .font(.system(size: 52))
                .foregroundStyle(Color(hex: 0xFF6B4A))
            Text("Session Expired")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color(hex: 0x1B2B65))
            Text("Your saved session is no longer valid. Restore it to continue or sign in again.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)

            Button("Restore Session") {
                Task { await authService.restoreSession() }
            }
            .buttonStyle(.borderedProminent)
            .tint(Color(hex: 0x1B2B65))

            Button("Sign In Again") {
                Task { await authService.signOut() }
            }
            .buttonStyle(.bordered)
            .tint(Color(hex: 0xFF6B4A))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }

    private var authUnavailableView: some View {
        VStack(spacing: 20) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 52))
                .foregroundStyle(Color(hex: 0xFF6B4A))
            Text("Authentication Unavailable")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color(hex: 0x1B2B65))
            Text("Authentication is temporarily unavailable. Retry the session check or sign in again once service is back.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)

            Button("Retry") {
                Task { await authService.initialize() }
            }
            .buttonStyle(.borderedProminent)
            .tint(Color(hex: 0x1B2B65))

            Button("Sign Out") {
                Task { await authService.signOut() }
            }
            .buttonStyle(.bordered)
            .tint(Color(hex: 0xFF6B4A))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }

}
