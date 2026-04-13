import SwiftUI

struct SignInView: View {

    @Environment(AuthService.self) private var authService

    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: BrandTheme.Spacing.stackLoose) {
            Spacer()

            // Logo + title
            VStack(spacing: BrandTheme.Spacing.inlineDefault) {
                Image(systemName: "house.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(BrandTheme.SemanticColor.actionPrimary)
                Text("buyer-codex")
                    .font(.brand(BrandTheme.Typography.display))
                    .foregroundStyle(BrandTheme.SemanticColor.textBrand)
                Text("AI-native Florida buyer brokerage")
                    .font(.brand(BrandTheme.Typography.body))
                    .foregroundStyle(BrandTheme.SemanticColor.textSecondary)
            }

            // Form fields
            VStack(spacing: BrandTheme.Spacing.cardPaddingDense) {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .padding(.horizontal, BrandTheme.Spacing.controlX)
                    .padding(.vertical, BrandTheme.Spacing.controlY)
                    .background(BrandTheme.SemanticColor.surfaceMuted)
                    .clipShape(RoundedRectangle(cornerRadius: BrandTheme.Radius.control))

                SecureField("Password", text: $password)
                    .textContentType(.password)
                    .padding(.horizontal, BrandTheme.Spacing.controlX)
                    .padding(.vertical, BrandTheme.Spacing.controlY)
                    .background(BrandTheme.SemanticColor.surfaceMuted)
                    .clipShape(RoundedRectangle(cornerRadius: BrandTheme.Radius.control))
            }
            .padding(.horizontal, BrandTheme.Layout.pagePaddingMobile)

            // Error message
            if let errorMessage {
                Text(errorMessage)
                    .font(.brand(BrandTheme.Typography.caption))
                    .foregroundStyle(BrandTheme.SemanticColor.statusError)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, BrandTheme.Layout.pagePaddingMobile)
            }

            // Sign in button
            Button {
                Task { await signIn() }
            } label: {
                Group {
                    if isLoading {
                        ProgressView()
                            .tint(BrandTheme.SemanticColor.textInverse)
                    } else {
                        Text("Sign In")
                            .font(.brand(BrandTheme.Typography.body))
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, BrandTheme.Spacing.cardPaddingDense)
            }
            .buttonStyle(.borderedProminent)
            .tint(BrandTheme.SemanticColor.actionPrimary)
            .clipShape(RoundedRectangle(cornerRadius: BrandTheme.Radius.control))
            .padding(.horizontal, BrandTheme.Layout.pagePaddingMobile)
            .disabled(isLoading)

            Spacer()
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(BrandTheme.SemanticColor.surfaceCanvas)
    }

    // MARK: - Actions

    private func signIn() async {
        errorMessage = nil

        guard !email.trimmingCharacters(in: .whitespaces).isEmpty else {
            errorMessage = "Please enter your email address."
            return
        }
        guard !password.isEmpty else {
            errorMessage = "Please enter your password."
            return
        }

        isLoading = true
        defer { isLoading = false }

        do {
            try await authService.signIn(email: email, password: password)
        } catch {
            errorMessage = "Sign in failed. Please check your credentials."
        }
    }
}
