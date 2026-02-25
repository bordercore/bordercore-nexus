import XCTest
@testable import Bordercore

final class ReminderNotificationServiceTests: XCTestCase {
    func testBuildPlanIncludesOnlyActiveFutureReminders() {
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        let activeFuture = ReminderItem(
            uuid: UUID(uuidString: "11111111-1111-1111-1111-111111111111")!,
            name: "Pay rent",
            note: "Today",
            isActive: true,
            scheduleType: "once",
            scheduleDescription: "Monthly",
            nextTriggerAt: now.addingTimeInterval(3600)
        )
        let inactive = ReminderItem(
            uuid: UUID(uuidString: "22222222-2222-2222-2222-222222222222")!,
            name: "Inactive",
            isActive: false,
            nextTriggerAt: now.addingTimeInterval(3600)
        )
        let missingDate = ReminderItem(
            uuid: UUID(uuidString: "33333333-3333-3333-3333-333333333333")!,
            name: "No date",
            isActive: true,
            nextTriggerAt: nil
        )
        let past = ReminderItem(
            uuid: UUID(uuidString: "44444444-4444-4444-4444-444444444444")!,
            name: "Past",
            isActive: true,
            nextTriggerAt: now.addingTimeInterval(-60)
        )

        let plan = ReminderNotificationService.buildPlan(
            reminders: [activeFuture, inactive, missingDate, past],
            existingManagedIdentifiers: Set(),
            now: now
        )

        XCTAssertEqual(plan.desiredNotifications.count, 1)
        XCTAssertEqual(plan.desiredNotifications.first?.title, "Pay rent")
    }

    func testBuildPlanMarksMissingManagedIdentifiersAsStale() {
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        let reminder = ReminderItem(
            uuid: UUID(uuidString: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")!,
            name: "One",
            isActive: true,
            nextTriggerAt: now.addingTimeInterval(600)
        )
        let keepId = ReminderNotificationService.notificationIdentifier(for: reminder.uuid)
        let staleId = "reminder.bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

        let plan = ReminderNotificationService.buildPlan(
            reminders: [reminder],
            existingManagedIdentifiers: Set([keepId, staleId]),
            now: now
        )

        XCTAssertEqual(plan.staleIdentifiers, [staleId])
        XCTAssertEqual(plan.upsertIdentifiers, [keepId])
    }

    func testBuildPlanUpsertsUpdatedReminderWithSameIdentifier() {
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        let uuid = UUID(uuidString: "cccccccc-cccc-cccc-cccc-cccccccccccc")!

        let older = ReminderItem(
            uuid: uuid,
            name: "Hydrate",
            note: "old",
            isActive: true,
            nextTriggerAt: now.addingTimeInterval(1200)
        )
        let updated = ReminderItem(
            uuid: uuid,
            name: "Hydrate",
            note: "new",
            isActive: true,
            nextTriggerAt: now.addingTimeInterval(1800)
        )

        let existingId = ReminderNotificationService.notificationIdentifier(for: uuid)
        let plan = ReminderNotificationService.buildPlan(
            reminders: [older, updated],
            existingManagedIdentifiers: Set([existingId]),
            now: now
        )

        XCTAssertEqual(plan.desiredNotifications.count, 1)
        XCTAssertEqual(plan.desiredNotifications.first?.identifier, existingId)
        XCTAssertEqual(plan.desiredNotifications.first?.body, "new")
        XCTAssertTrue(plan.staleIdentifiers.isEmpty)
        XCTAssertEqual(plan.upsertIdentifiers, [existingId])
    }
}
