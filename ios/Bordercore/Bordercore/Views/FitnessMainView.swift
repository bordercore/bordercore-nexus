import SwiftUI

struct FitnessMainView: View {
    @StateObject private var viewModel = FitnessViewModel()
    let onBack: () -> Void

    init(onBack: @escaping () -> Void = {}) {
        self.onBack = onBack
    }

    var body: some View {
        NavigationStack {
            FitnessListView(viewModel: viewModel)
                .navigationTitle("Fitness")
                .toolbar {
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
        }
        .task {
            await viewModel.loadInitialData()
        }
    }
}

#Preview {
    FitnessMainView()
}
