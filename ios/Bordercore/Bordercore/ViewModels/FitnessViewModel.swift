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
            activeExercises = sortActiveExercises(summary.active)
            inactiveExercises = sortInactiveExercises(summary.inactive)
        } catch {
            handleError(error)
        }
    }

    private func sortActiveExercises(_ exercises: [FitnessExercise]) -> [FitnessExercise] {
        let currentWeekday = (Calendar.current.component(.weekday, from: Date()) + 5) % 7

        return exercises.enumerated().sorted { lhs, rhs in
            let leftOffset = nextScheduledDayOffset(for: lhs.element.schedule, currentWeekday: currentWeekday)
            let rightOffset = nextScheduledDayOffset(for: rhs.element.schedule, currentWeekday: currentWeekday)

            if leftOffset != rightOffset {
                return leftOffset < rightOffset
            }

            return lhs.offset < rhs.offset
        }.map(\.element)
    }

    private func sortInactiveExercises(_ exercises: [FitnessExercise]) -> [FitnessExercise] {
        exercises.enumerated().sorted { lhs, rhs in
            let comparison = lhs.element.name.localizedCaseInsensitiveCompare(rhs.element.name)
            if comparison != .orderedSame {
                return comparison == .orderedAscending
            }

            return lhs.offset < rhs.offset
        }.map(\.element)
    }

    private func nextScheduledDayOffset(for schedule: [Bool], currentWeekday: Int) -> Int {
        guard schedule.count == 7 else { return 999 }

        for offset in 0..<7 {
            let dayIndex = (currentWeekday + offset) % 7
            if schedule[dayIndex] {
                return offset
            }
        }

        return 999
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
