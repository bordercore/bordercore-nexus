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
}

struct SplashView: View {
    @State private var destination: SplashDestination?

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
            case nil:
                splashContent
            }
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
            }
            .padding(.top, 8)

            Spacer()
        }
        .padding(.horizontal, 24)
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

                            Button(role: .destructive) {
                                AuthManager.shared.logout()
                            } label: {
                                Label("Logout", systemImage: "rectangle.portrait.and.arrow.right")
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
