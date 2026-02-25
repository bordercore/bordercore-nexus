import Foundation

struct ReminderItem: Identifiable, Codable, Equatable {
    let uuid: UUID
    let name: String
    let note: String?
    let isActive: Bool
    let scheduleType: String
    let scheduleDescription: String
    let nextTriggerAt: Date?

    var id: UUID { uuid }

    enum CodingKeys: String, CodingKey {
        case uuid
        case name
        case note
        case isActive = "is_active"
        case scheduleType = "schedule_type"
        case scheduleDescription = "schedule_description"
        case nextTriggerAt = "next_trigger_at"
    }

    init(
        uuid: UUID,
        name: String,
        note: String? = nil,
        isActive: Bool = true,
        scheduleType: String = "",
        scheduleDescription: String = "",
        nextTriggerAt: Date? = nil
    ) {
        self.uuid = uuid
        self.name = name
        self.note = note
        self.isActive = isActive
        self.scheduleType = scheduleType
        self.scheduleDescription = scheduleDescription
        self.nextTriggerAt = nextTriggerAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        uuid = try container.decode(UUID.self, forKey: .uuid)
        name = try container.decode(String.self, forKey: .name)
        note = try container.decodeIfPresent(String.self, forKey: .note)
        isActive = try container.decodeIfPresent(Bool.self, forKey: .isActive) ?? true
        scheduleType = try container.decodeIfPresent(String.self, forKey: .scheduleType) ?? ""
        scheduleDescription = try container.decodeIfPresent(String.self, forKey: .scheduleDescription) ?? ""

        if let nextTriggerAtString = try container.decodeIfPresent(String.self, forKey: .nextTriggerAt),
           !nextTriggerAtString.isEmpty {
            nextTriggerAt = ReminderItem.parseDate(nextTriggerAtString)
        } else {
            nextTriggerAt = nil
        }
    }

    private static func parseDate(_ value: String) -> Date? {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: value) {
            return date
        }

        iso.formatOptions = [.withInternetDateTime]
        return iso.date(from: value)
    }
}
