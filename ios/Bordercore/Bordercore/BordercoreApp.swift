import SwiftUI
import UIKit
import UserNotifications

@MainActor
final class AppNavigationRouter: ObservableObject {
    static let shared = AppNavigationRouter()

    enum Route: Equatable {
        case reminders
        case reminderDetail(UUID)
    }

    @Published private(set) var pendingRoute: Route?

    private init() {}

    func open(_ route: Route) {
        pendingRoute = route
    }

    func consume(_ route: Route) {
        guard pendingRoute == route else { return }
        pendingRoute = nil
    }
}

@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let identifier = response.notification.request.identifier
        if let reminderUUID = ReminderNotificationService.reminderUUID(fromNotificationIdentifier: identifier) {
            Task { @MainActor in
                AppNavigationRouter.shared.open(.reminderDetail(reminderUUID))
            }
        } else if identifier.hasPrefix(ReminderNotificationService.managedPrefix) {
            Task { @MainActor in
                AppNavigationRouter.shared.open(.reminders)
            }
        }
        completionHandler()
    }
}

@main
struct BordercoreApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var authManager = AuthManager.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
        }
    }
}
