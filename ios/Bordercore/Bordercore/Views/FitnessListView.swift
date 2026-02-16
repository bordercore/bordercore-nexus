import SwiftUI

struct FitnessListView: View {
    @ObservedObject var viewModel: FitnessViewModel

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
                                    FitnessExerciseDetailView(exerciseUUID: exercise.uuid)
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
                                    FitnessExerciseDetailView(exerciseUUID: exercise.uuid)
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

#Preview {
    NavigationStack {
        FitnessListView(viewModel: FitnessViewModel())
            .navigationTitle("Fitness")
    }
}
