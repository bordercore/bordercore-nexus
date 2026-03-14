import Foundation

actor FitnessService {
    static let shared = FitnessService()

    private struct CreateWorkoutPayload: Encodable {
        struct WorkoutSet: Encodable {
            let weight: Double
            let duration: Int
            let reps: Int
        }

        let note: String
        let sets: [WorkoutSet]
    }

    private init() {}

    func fetchSummary(token: String) async throws -> FitnessSummaryResponse {
        try await APIClient.shared.get("/api/fitness/summary/", token: token)
    }

    func fetchExerciseDetail(uuid: UUID, token: String) async throws -> FitnessExerciseDetail {
        try await APIClient.shared.get("/api/fitness/exercise/\(uuid.uuidString.lowercased())/", token: token)
    }

    func createWorkout(
        exerciseUUID: UUID,
        note: String,
        sets: [FitnessWorkoutSet],
        token: String
    ) async throws {
        let payload = CreateWorkoutPayload(
            note: note,
            sets: sets.map {
                CreateWorkoutPayload.WorkoutSet(
                    weight: Double($0.weight.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0,
                    duration: Int($0.duration.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0,
                    reps: Int($0.reps.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
                )
            }
        )

        try await APIClient.shared.post(
            "/api/fitness/exercise/\(exerciseUUID.uuidString.lowercased())/workouts/",
            token: token,
            body: payload
        )
    }
}
