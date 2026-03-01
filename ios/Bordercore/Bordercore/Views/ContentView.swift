import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: AuthManager

    var body: some View {
        Group {
            if authManager.isAuthenticated {
                SplashView()
            } else {
                LoginView()
            }
        }
    }
}

private enum SplashDestination {
    case bookmarks
    case todo
    case reminders
    case fitness
}

struct SplashView: View {
    @State private var destination: SplashDestination?
    @StateObject private var navigationRouter = AppNavigationRouter.shared
    @State private var deepLinkedReminderUUID: UUID?

    var body: some View {
        Group {
            switch destination {
            case .bookmarks:
                MainView {
                    destination = nil
                }
            case .todo:
                TodoMainView {
                    destination = nil
                }
            case .reminders:
                ReminderMainView(deepLinkedReminderUUID: deepLinkedReminderUUID) {
                    destination = nil
                }
            case .fitness:
                FitnessMainView {
                    destination = nil
                }
            case nil:
                splashContent
            }
        }
        .onAppear {
            applyPendingRoute()
        }
        .onChange(of: navigationRouter.pendingRoute) { _, _ in
            applyPendingRoute()
        }
    }

    private var splashContent: some View {
        VStack(spacing: 24) {
            Text("Bordercore")
                .font(.system(size: 38, weight: .black))
                .foregroundStyle(
                    LinearGradient(
                        colors: [Color.green, Color.cyan, Color.pink],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .shadow(color: Color.cyan.opacity(0.6), radius: 10, x: 0, y: 0)
                .shadow(color: Color.pink.opacity(0.45), radius: 16, x: 0, y: 0)
                .padding(.top, 40)

            Image("BordercoreLogo")
                .resizable()
                .scaledToFit()
                .frame(maxWidth: 280)

            VStack(spacing: 14) {
                SplashLinkButton(
                    title: "Bookmarks",
                    subtitle: "Open your links",
                    gradient: [Color.blue, Color.cyan]
                ) {
                    destination = .bookmarks
                }

                SplashLinkButton(
                    title: "Todo",
                    subtitle: "Track your tasks",
                    gradient: [Color.orange, Color.pink]
                ) {
                    destination = .todo
                }

                SplashLinkButton(
                    title: "Reminders",
                    subtitle: "See upcoming triggers",
                    gradient: [Color.indigo, Color.blue]
                ) {
                    destination = .reminders
                }

                SplashLinkButton(
                    title: "Fitness",
                    subtitle: "Review workouts",
                    gradient: [Color.green, Color.teal]
                ) {
                    destination = .fitness
                }
            }
            .padding(.top, 8)

            Button("Logout") {
                AuthManager.shared.logout()
            }
            .font(.footnote.weight(.semibold))
            .foregroundStyle(.secondary)
            .accessibilityLabel("Log out of Bordercore")
            .buttonStyle(.plain)
            .padding(.top, 4)
            .frame(maxWidth: .infinity, alignment: .center)

            Spacer()
        }
        .padding(.horizontal, 24)
    }

    private func applyPendingRoute() {
        guard let route = navigationRouter.pendingRoute else { return }

        switch route {
        case .reminders:
            deepLinkedReminderUUID = nil
            destination = .reminders
            navigationRouter.consume(.reminders)
        case .reminderDetail(let uuid):
            deepLinkedReminderUUID = uuid
            destination = .reminders
            navigationRouter.consume(.reminderDetail(uuid))
        }
    }
}

private struct SplashLinkButton: View {
    let title: String
    let subtitle: String
    let gradient: [Color]
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 26, weight: .bold))
                        .foregroundStyle(.white)

                    Text(subtitle)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(.white.opacity(0.9))
                }

                Spacer()

                Image(systemName: "arrow.right.circle.fill")
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.95))
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 18)
            .frame(maxWidth: .infinity)
            .background(
                LinearGradient(colors: gradient, startPoint: .topLeading, endPoint: .bottomTrailing)
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(.white.opacity(0.25), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.2), radius: 12, y: 6)
        }
        .buttonStyle(.plain)
    }
}

@MainActor
private final class ReminderViewModel: ObservableObject {
    @Published var reminders: [ReminderItem] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let authManager: AuthManager
    private let notificationService: ReminderNotificationService

    init(
        authManager: AuthManager = .shared,
        notificationService: ReminderNotificationService = .shared
    ) {
        self.authManager = authManager
        self.notificationService = notificationService
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        _ = await notificationService.requestAuthorizationIfNeeded()
        await reload()
    }

    func reload() async {
        guard let token = authManager.getToken() else {
            errorMessage = "Not authenticated"
            reminders = []
            return
        }

        do {
            reminders = try await APIClient.shared.getList("/api/reminders/", token: token)
            errorMessage = nil
            await notificationService.sync(reminders: reminders)
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            reminders = []
        }
    }
}

private struct ReminderRowView: View {
    let reminder: ReminderItem

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                Circle()
                    .fill(reminder.isActive ? Color.green : Color.gray)
                    .frame(width: 10, height: 10)
                    .padding(.top, 5)

                Text(reminder.name)
                    .font(.headline)

                Spacer(minLength: 0)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(reminder.scheduleDescription)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                if let triggerAt = reminder.nextTriggerAt {
                    TimelineView(.periodic(from: .now, by: 60)) { context in
                        Text(relativeTriggerText(for: triggerAt, now: context.date))
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                } else {
                    Text("No next trigger")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(.leading, 20)
        }
        .padding(.vertical, 4)
    }

    private func relativeTriggerText(for date: Date, now: Date) -> String {
        let isFuture = date >= now
        let interval = abs(date.timeIntervalSince(now))

        let minute: TimeInterval = 60
        let hour: TimeInterval = 60 * minute
        let day: TimeInterval = 24 * hour

        let value: Int
        let unit: String
        if interval < hour {
            value = max(1, Int(interval / minute))
            unit = value == 1 ? "minute" : "minutes"
        } else if interval < day {
            value = max(1, Int(interval / hour))
            unit = value == 1 ? "hour" : "hours"
        } else {
            value = max(1, Int(interval / day))
            unit = value == 1 ? "day" : "days"
        }

        return isFuture ? "\(value) \(unit) from now" : "\(value) \(unit) ago"
    }
}

private struct ReminderDetailView: View {
    let reminder: ReminderItem

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Label(reminder.isActive ? "Active" : "Inactive", systemImage: reminder.isActive ? "checkmark.circle.fill" : "pause.circle.fill")
                    .foregroundStyle(reminder.isActive ? .green : .secondary)
                    .font(.subheadline.weight(.semibold))

                Text(reminder.name)
                    .font(.title2.weight(.bold))

                detailRow(title: "Schedule", value: reminder.scheduleDescription.isEmpty ? "Not set" : reminder.scheduleDescription)

                if !reminder.scheduleType.isEmpty {
                    detailRow(title: "Type", value: reminder.scheduleType)
                }

                if let nextTriggerAt = reminder.nextTriggerAt {
                    detailRow(title: "Next Trigger", value: dateText(nextTriggerAt))
                } else {
                    detailRow(title: "Next Trigger", value: "No next trigger")
                }

                if let note = reminder.note, !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Note")
                            .font(.headline)
                        Text(note)
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.top, 8)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
        .navigationTitle("Reminder")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func detailRow(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.body)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func dateText(_ date: Date) -> String {
        date.formatted(date: .complete, time: .shortened)
    }
}

private struct ReminderListView: View {
    @ObservedObject var viewModel: ReminderViewModel

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.reminders.isEmpty {
                ProgressView("Loading...")
            } else if viewModel.reminders.isEmpty {
                ContentUnavailableView(
                    "No Reminders",
                    systemImage: "bell.slash",
                    description: Text("No reminders found")
                )
            } else {
                List {
                    ForEach(viewModel.reminders) { reminder in
                        NavigationLink(value: reminder.uuid) {
                            ReminderRowView(reminder: reminder)
                        }
                    }
                }
                .listStyle(.plain)
                .refreshable {
                    await viewModel.reload()
                }
            }
        }
        .overlay(alignment: .bottom) {
            if let error = viewModel.errorMessage {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.white)
                    .padding()
                    .background(Color.red.opacity(0.9))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .padding()
                    .transition(.move(edge: .bottom))
            }
        }
        .animation(.easeInOut, value: viewModel.errorMessage)
    }
}

private struct ReminderMainView: View {
    @StateObject private var viewModel = ReminderViewModel()
    @Environment(\.scenePhase) private var scenePhase
    @State private var navigationPath: [UUID] = []
    @State private var pendingReminderUUID: UUID?
    let deepLinkedReminderUUID: UUID?
    let onBack: () -> Void

    init(deepLinkedReminderUUID: UUID? = nil, onBack: @escaping () -> Void = {}) {
        self.deepLinkedReminderUUID = deepLinkedReminderUUID
        self.onBack = onBack
    }

    var body: some View {
        NavigationStack(path: $navigationPath) {
            ReminderListView(viewModel: viewModel)
                .navigationTitle("Reminders")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Menu {
                            Button {
                                onBack()
                            } label: {
                                Label("Back", systemImage: "chevron.left")
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                        }
                    }
                }
                .navigationDestination(for: UUID.self) { reminderID in
                    if let reminder = reminder(for: reminderID) {
                        ReminderDetailView(reminder: reminder)
                    } else {
                        ContentUnavailableView(
                            "Reminder Not Found",
                            systemImage: "bell.slash",
                            description: Text("This reminder is no longer available")
                        )
                    }
                }
        }
        .task {
            pendingReminderUUID = deepLinkedReminderUUID
            await viewModel.load()
            openPendingReminderIfPossible()
        }
        .onChange(of: scenePhase) { _, newPhase in
            guard newPhase == .active else { return }
            Task {
                await viewModel.reload()
                openPendingReminderIfPossible()
            }
        }
        .onChange(of: deepLinkedReminderUUID) { _, newValue in
            pendingReminderUUID = newValue
            openPendingReminderIfPossible()
        }
        .onChange(of: viewModel.reminders) { _, _ in
            openPendingReminderIfPossible()
        }
    }

    private func reminder(for uuid: UUID) -> ReminderItem? {
        viewModel.reminders.first { $0.uuid == uuid }
    }

    private func openPendingReminderIfPossible() {
        guard let reminderUUID = pendingReminderUUID else { return }
        guard reminder(for: reminderUUID) != nil else { return }
        navigationPath = [reminderUUID]
        pendingReminderUUID = nil
    }
}

struct MainView: View {
    @StateObject private var viewModel = BookmarkViewModel()
    @State private var showSidebar = false
    let onBack: () -> Void

    init(onBack: @escaping () -> Void = {}) {
        self.onBack = onBack
    }

    var body: some View {
        NavigationStack {
            BookmarkListView(viewModel: viewModel)
                .navigationTitle(viewModel.viewState.title)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            showSidebar = true
                        } label: {
                            Image(systemName: "line.3.horizontal")
                        }
                    }

                    ToolbarItem(placement: .topBarTrailing) {
                        Menu {
                            Button {
                                onBack()
                            } label: {
                                Label("Back", systemImage: "chevron.left")
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                        }
                    }
                }
                .sheet(isPresented: $showSidebar) {
                    TagSidebarView(viewModel: viewModel, isPresented: $showSidebar)
                }
        }
        .task {
            await viewModel.loadInitialData()
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthManager.shared)
}
