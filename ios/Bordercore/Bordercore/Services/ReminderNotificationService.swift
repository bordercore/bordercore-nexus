import Foundation
import UserNotifications

struct ScheduledReminderNotification: Equatable {
    let identifier: String
    let title: String
    let body: String
    let triggerDate: Date
}

struct ReminderNotificationPlan: Equatable {
    let desiredNotifications: [ScheduledReminderNotification]
    let staleIdentifiers: [String]
    let upsertIdentifiers: [String]
}

actor ReminderNotificationService {
    static let shared = ReminderNotificationService()
    static let managedPrefix = "reminder."

    private let center: UNUserNotificationCenter
    private var hasRequestedAuthorizationThisSession = false

    init(center: UNUserNotificationCenter = .current()) {
        self.center = center
    }

    func requestAuthorizationIfNeeded() async -> Bool {
        let authorizationStatus = await notificationAuthorizationStatus()
        switch authorizationStatus {
        case .authorized, .provisional:
            debugLog("notifications authorized")
            return true
        case .denied:
            debugLog("notifications denied")
            return false
        case .notDetermined:
            if hasRequestedAuthorizationThisSession {
                return false
            }

            hasRequestedAuthorizationThisSession = true
            do {
                let granted = try await requestAuthorization()
                debugLog("authorization prompt completed (granted=\(granted))")
                return granted
            } catch {
                debugLog("authorization request failed: \(error.localizedDescription)")
                return false
            }
        @unknown default:
            return false
        }
    }

    func sync(reminders: [ReminderItem]) async {
        let isAuthorized = await requestAuthorizationIfNeeded()
        guard isAuthorized else {
            return
        }

        let existingManagedIdentifiers = Set(await pendingManagedNotificationIdentifiers())

        let plan = Self.buildPlan(
            reminders: reminders,
            existingManagedIdentifiers: existingManagedIdentifiers,
            now: Date()
        )

        if !plan.staleIdentifiers.isEmpty {
            center.removePendingNotificationRequests(withIdentifiers: plan.staleIdentifiers)
        }

        if !plan.upsertIdentifiers.isEmpty {
            center.removePendingNotificationRequests(withIdentifiers: plan.upsertIdentifiers)
        }

        for notification in plan.desiredNotifications {
            let content = UNMutableNotificationContent()
            content.title = notification.title
            content.body = notification.body
            content.sound = .default

            let components = Calendar.current.dateComponents(
                [.year, .month, .day, .hour, .minute, .second],
                from: notification.triggerDate
            )
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            let request = UNNotificationRequest(
                identifier: notification.identifier,
                content: content,
                trigger: trigger
            )

            do {
                try await add(request)
            } catch {
                debugLog("failed to schedule \(notification.identifier): \(error.localizedDescription)")
            }
        }

        debugLog(
            "sync complete (desired=\(plan.desiredNotifications.count), stale=\(plan.staleIdentifiers.count), upsert=\(plan.upsertIdentifiers.count))"
        )
    }

    func cancelAllManagedNotifications() async {
        let ids = await pendingManagedNotificationIdentifiers()
        guard !ids.isEmpty else { return }
        center.removePendingNotificationRequests(withIdentifiers: ids)
    }

    static func buildPlan(
        reminders: [ReminderItem],
        existingManagedIdentifiers: Set<String>,
        now: Date
    ) -> ReminderNotificationPlan {
        var latestByIdentifier: [String: ScheduledReminderNotification] = [:]

        for reminder in reminders {
            guard reminder.isActive, let nextTriggerAt = reminder.nextTriggerAt, nextTriggerAt > now else {
                continue
            }

            let identifier = notificationIdentifier(for: reminder.uuid)
            let title = renderedMarkdownText(reminder.name) ?? "Reminder"
            let body = renderedMarkdownText(reminder.note) ?? "Reminder is due now"
            let notification = ScheduledReminderNotification(
                identifier: identifier,
                title: title,
                body: body,
                triggerDate: nextTriggerAt
            )
            latestByIdentifier[identifier] = notification
        }

        let desired = latestByIdentifier.values.sorted { lhs, rhs in
            lhs.triggerDate < rhs.triggerDate
        }
        let desiredIds = Set(desired.map(\.identifier))
        let staleIds = existingManagedIdentifiers.subtracting(desiredIds).sorted()

        return ReminderNotificationPlan(
            desiredNotifications: desired,
            staleIdentifiers: staleIds,
            upsertIdentifiers: desired.map(\.identifier)
        )
    }

    static func notificationIdentifier(for uuid: UUID) -> String {
        "\(managedPrefix)\(uuid.uuidString.lowercased())"
    }

    static func reminderUUID(fromNotificationIdentifier identifier: String) -> UUID? {
        guard identifier.hasPrefix(managedPrefix) else { return nil }
        let uuidString = String(identifier.dropFirst(managedPrefix.count))
        return UUID(uuidString: uuidString)
    }

    private static func renderedMarkdownText(_ source: String?) -> String? {
        guard let source else { return nil }
        let trimmed = source.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        if let attributed = try? AttributedString(markdown: trimmed) {
            let plain = String(attributed.characters).trimmingCharacters(in: .whitespacesAndNewlines)
            if !plain.isEmpty {
                return plain
            }
        }

        return trimmed
    }

    private func notificationAuthorizationStatus() async -> UNAuthorizationStatus {
        await withCheckedContinuation { continuation in
            center.getNotificationSettings { settings in
                continuation.resume(returning: settings.authorizationStatus)
            }
        }
    }

    private func requestAuthorization() async throws -> Bool {
        try await withCheckedThrowingContinuation { continuation in
            center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: granted)
            }
        }
    }

    private func pendingManagedNotificationIdentifiers() async -> [String] {
        await withCheckedContinuation { continuation in
            center.getPendingNotificationRequests { requests in
                let managedIds = requests
                    .map(\.identifier)
                    .filter { $0.hasPrefix(Self.managedPrefix) }
                continuation.resume(returning: managedIds)
            }
        }
    }

    private func add(_ request: UNNotificationRequest) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            center.add(request) { error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: ())
            }
        }
    }

    private func debugLog(_ message: String) {
        print("[ReminderNotificationService] \(message)")
    }
}
