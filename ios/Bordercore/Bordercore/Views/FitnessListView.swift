import SwiftUI

struct FitnessListView: View {
    @ObservedObject var viewModel: FitnessViewModel
    @State private var successToastMessage: String?
    @State private var toastDismissTask: Task<Void, Never>?

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.activeExercises.isEmpty && viewModel.inactiveExercises.isEmpty {
                ProgressView("Loading...")
            } else if viewModel.activeExercises.isEmpty && viewModel.inactiveExercises.isEmpty {
                ContentUnavailableView(
                    "No Workouts",
                    systemImage: "figure.strengthtraining.traditional",
                    description: Text("No fitness workouts found")
                )
            } else {
                List {
                    if !viewModel.activeExercises.isEmpty {
                        Section("Active") {
                            ForEach(viewModel.activeExercises) { exercise in
                                NavigationLink {
                                    FitnessExerciseDetailView(exerciseUUID: exercise.uuid) {
                                        await viewModel.refresh()
                                        showSuccessToast("Workout saved")
                                    }
                                } label: {
                                    FitnessRowView(exercise: exercise)
                                }
                            }
                        }
                    }

                    if !viewModel.inactiveExercises.isEmpty {
                        Section("Inactive") {
                            ForEach(viewModel.inactiveExercises) { exercise in
                                NavigationLink {
                                    FitnessExerciseDetailView(exerciseUUID: exercise.uuid) {
                                        await viewModel.refresh()
                                        showSuccessToast("Workout saved")
                                    }
                                } label: {
                                    FitnessRowView(exercise: exercise)
                                }
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .refreshable {
                    await viewModel.refresh()
                }
            }
        }
        .overlay(alignment: .bottom) {
            VStack(spacing: 8) {
                if let message = successToastMessage {
                    Text(message)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Color.green.opacity(0.95))
                        .clipShape(Capsule())
                        .shadow(color: .black.opacity(0.2), radius: 8, y: 4)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        .allowsHitTesting(false)
                }

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.white)
                        .padding()
                        .background(Color.red.opacity(0.9))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .padding()
        }
        .animation(.easeInOut, value: viewModel.errorMessage)
        .animation(.easeInOut, value: successToastMessage)
        .onDisappear {
            toastDismissTask?.cancel()
        }
    }

    private func showSuccessToast(_ message: String) {
        toastDismissTask?.cancel()
        withAnimation {
            successToastMessage = message
        }

        toastDismissTask = Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                withAnimation {
                    successToastMessage = nil
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        FitnessListView(viewModel: FitnessViewModel())
            .navigationTitle("Fitness")
    }
}
