import Foundation

struct FitnessSummaryResponse: Decodable {
    let active: [FitnessExercise]
    let inactive: [FitnessExercise]
}

struct FitnessExercise: Identifiable, Decodable, Equatable {
    let uuid: UUID
    let name: String
    let muscleGroup: String
    let lastActive: Date?
    let deltaDays: Int?
    let overdue: Int
    let schedule: [Bool]
    let scheduleDays: String
    let frequency: String

    var id: UUID { uuid }

    enum CodingKeys: String, CodingKey {
        case uuid
        case name
        case muscleGroup = "muscle_group"
        case lastActive = "last_active"
        case deltaDays = "delta_days"
        case overdue
        case schedule
        case scheduleDays = "schedule_days"
        case frequency
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        uuid = try container.decode(UUID.self, forKey: .uuid)
        name = try container.decode(String.self, forKey: .name)
        muscleGroup = try container.decodeIfPresent(String.self, forKey: .muscleGroup) ?? ""
        deltaDays = try container.decodeIfPresent(Int.self, forKey: .deltaDays)
        overdue = try container.decodeIfPresent(Int.self, forKey: .overdue) ?? 0
        schedule = try container.decodeIfPresent([Bool].self, forKey: .schedule) ?? []
        scheduleDays = try container.decodeIfPresent(String.self, forKey: .scheduleDays) ?? ""
        frequency = try container.decodeIfPresent(String.self, forKey: .frequency) ?? ""

        if let dateString = try container.decodeIfPresent(String.self, forKey: .lastActive) {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: dateString) {
                lastActive = date
            } else {
                formatter.formatOptions = [.withInternetDateTime]
                lastActive = formatter.date(from: dateString)
            }
        } else {
            lastActive = nil
        }
    }
}

struct FitnessExerciseDetail: Decodable, Equatable {
    let uuid: UUID
    let name: String
    let hasWeight: Bool
    let hasDuration: Bool
    let description: String
    let note: String
    let lastWorkoutDate: Date?
    let latestWeight: [Double]
    let latestReps: [Int]
    let latestDuration: [Int]

    enum CodingKeys: String, CodingKey {
        case uuid
        case name
        case hasWeight = "has_weight"
        case hasDuration = "has_duration"
        case description
        case note
        case lastWorkoutDate = "last_workout_date"
        case latestWeight = "latest_weight"
        case latestReps = "latest_reps"
        case latestDuration = "latest_duration"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        uuid = try container.decode(UUID.self, forKey: .uuid)
        name = try container.decode(String.self, forKey: .name)
        hasWeight = try container.decodeIfPresent(Bool.self, forKey: .hasWeight) ?? true
        hasDuration = try container.decodeIfPresent(Bool.self, forKey: .hasDuration) ?? true
        description = try container.decodeIfPresent(String.self, forKey: .description) ?? ""
        note = try container.decodeIfPresent(String.self, forKey: .note) ?? ""
        latestWeight = try container.decodeIfPresent([Double].self, forKey: .latestWeight) ?? []
        latestReps = try container.decodeIfPresent([Int].self, forKey: .latestReps) ?? []
        latestDuration = try container.decodeIfPresent([Int].self, forKey: .latestDuration) ?? []

        if let dateString = try container.decodeIfPresent(String.self, forKey: .lastWorkoutDate) {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: dateString) {
                lastWorkoutDate = date
            } else {
                formatter.formatOptions = [.withInternetDateTime]
                lastWorkoutDate = formatter.date(from: dateString)
            }
        } else {
            lastWorkoutDate = nil
        }
    }
}

struct FitnessWorkoutSet: Identifiable, Equatable {
    let id = UUID()
    var weight: String
    var duration: String
    var reps: String
}
