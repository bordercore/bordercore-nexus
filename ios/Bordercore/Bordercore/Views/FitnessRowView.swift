import SwiftUI

struct FitnessRowView: View {
    let exercise: FitnessExercise

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 8) {
                Text(exercise.name)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .truncationMode(.tail)

                Spacer(minLength: 0)

                if exercise.overdue > 0 {
                    Text(exercise.overdue == 2 ? "Overdue" : "Due Today")
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(statusColor.opacity(0.16))
                        .foregroundStyle(statusColor)
                        .clipShape(Capsule())
                }
            }

            if !exercise.muscleGroup.isEmpty {
                Text(exercise.muscleGroup)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }

            HStack(spacing: 12) {
                if let lastActive = exercise.lastActive {
                    Label(lastActive.formatted(.dateTime.month(.abbreviated).day()), systemImage: "calendar")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                if let deltaDays = exercise.deltaDays {
                    Label("\(deltaDays)d", systemImage: "clock")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                if !exercise.frequency.isEmpty {
                    Label(exercise.frequency, systemImage: "repeat")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private var statusColor: Color {
        exercise.overdue == 2 ? .red : .orange
    }
}

#Preview {
    List {
        FitnessRowView(
            exercise: FitnessExercise(
                uuid: UUID(),
                name: "Barbell Row",
                muscleGroup: "Back",
                lastActive: .now.addingTimeInterval(-86_400 * 4),
                deltaDays: 4,
                overdue: 1,
                schedule: [true, false, true, false, false, false, false],
                scheduleDays: "Mon Wed Fri",
                frequency: "3 days"
            )
        )
    }
}

private extension FitnessExercise {
    init(
        uuid: UUID,
        name: String,
        muscleGroup: String,
        lastActive: Date?,
        deltaDays: Int?,
        overdue: Int,
        schedule: [Bool],
        scheduleDays: String,
        frequency: String
    ) {
        self.uuid = uuid
        self.name = name
        self.muscleGroup = muscleGroup
        self.lastActive = lastActive
        self.deltaDays = deltaDays
        self.overdue = overdue
        self.schedule = schedule
        self.scheduleDays = scheduleDays
        self.frequency = frequency
    }
}
