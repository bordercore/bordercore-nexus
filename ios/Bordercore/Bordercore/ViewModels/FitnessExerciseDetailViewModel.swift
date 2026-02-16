import Foundation

@MainActor
final class FitnessExerciseDetailViewModel: ObservableObject {
    @Published var detail: FitnessExerciseDetail?
    @Published var isLoading = false
    @Published var isSubmitting = false
    @Published var errorMessage: String?

    @Published var weight = ""
    @Published var duration = ""
    @Published var reps = ""
    @Published var note = ""
    @Published var sets: [FitnessWorkoutSet] = []

    private let authManager: AuthManager
    private let exerciseUUID: UUID

    init(exerciseUUID: UUID, authManager: AuthManager = .shared) {
        self.exerciseUUID = exerciseUUID
        self.authManager = authManager
    }

    var canAddSet: Bool {
        let weightValue = Double(weight.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
        let durationValue = Int(duration.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
        let repsValue = Int(reps.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
        return weightValue > 0 || durationValue > 0 || repsValue > 0
    }

    var canSubmit: Bool {
        !sets.isEmpty && !isSubmitting
    }

    func load() async {
        guard let token = authManager.getToken() else { return }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let fetchedDetail = try await FitnessService.shared.fetchExerciseDetail(uuid: exerciseUUID, token: token)
            detail = fetchedDetail
            weight = String(formatNumeric(fetchedDetail.latestWeight.first ?? 0))
            reps = String(fetchedDetail.latestReps.first ?? 0)
            duration = String(fetchedDetail.latestDuration.first ?? 0)
            note = ""
        } catch {
            handleError(error)
        }
    }

    func addSet() {
        guard canAddSet else { return }
        sets.append(
            FitnessWorkoutSet(
                weight: normalizeNumericString(weight),
                duration: normalizeIntegerString(duration),
                reps: normalizeIntegerString(reps)
            )
        )
    }

    func removeSets(at offsets: IndexSet) {
        sets.remove(atOffsets: offsets)
    }

    func submit() async {
        guard canSubmit, let token = authManager.getToken() else { return }

        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        do {
            try await FitnessService.shared.createWorkout(
                exerciseUUID: exerciseUUID,
                note: note.trimmingCharacters(in: .whitespacesAndNewlines),
                sets: sets,
                token: token
            )
            sets.removeAll()
            note = ""
            await load()
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

    private func normalizeNumericString(_ value: String) -> String {
        let numeric = Double(value.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
        return String(formatNumeric(numeric))
    }

    private func normalizeIntegerString(_ value: String) -> String {
        let numeric = Int(value.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
        return String(numeric)
    }

    private func formatNumeric(_ value: Double) -> String {
        if value.rounded() == value {
            return String(Int(value))
        }
        return String(value)
    }
}
