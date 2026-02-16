import Foundation

@MainActor
final class FitnessViewModel: ObservableObject {
    @Published var activeExercises: [FitnessExercise] = []
    @Published var inactiveExercises: [FitnessExercise] = []
    @Published var isLoading = false
    @Published var isRefreshing = false
    @Published var errorMessage: String?

    private let authManager: AuthManager

    init(authManager: AuthManager = .shared) {
        self.authManager = authManager
    }

    func loadInitialData() async {
        isLoading = true
        errorMessage = nil
        await loadSummary()
        isLoading = false
    }

    func refresh() async {
        isRefreshing = true
        await loadSummary()
        isRefreshing = false
    }

    private func loadSummary() async {
        guard let token = authManager.getToken() else { return }

        do {
            let summary = try await FitnessService.shared.fetchSummary(token: token)
            activeExercises = summary.active
            inactiveExercises = summary.inactive
        } catch {
            handleError(error)
        }
    }

    private func handleError(_ error: Error) {
        if let apiError = error as? APIError {
            errorMessage = apiError.localizedDescription
            if case .unauthorized = apiError {
                authManager.logout()
            }
        } else {
            errorMessage = error.localizedDescription
        }
    }
}
