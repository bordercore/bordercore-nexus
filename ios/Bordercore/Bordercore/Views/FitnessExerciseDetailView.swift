import SwiftUI
import UIKit

struct FitnessExerciseDetailView: View {
    @StateObject private var viewModel: FitnessExerciseDetailViewModel

    init(exerciseUUID: UUID) {
        _viewModel = StateObject(wrappedValue: FitnessExerciseDetailViewModel(exerciseUUID: exerciseUUID))
    }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.detail == nil {
                ProgressView("Loading...")
            } else {
                Form {
                    Section("New Workout Data") {
                        if viewModel.detail?.hasWeight ?? true {
                            HStack {
                                Text("Weight")
                                SelectAllTextField(
                                    placeholder: "Weight",
                                    text: $viewModel.weight,
                                    keyboardType: .decimalPad
                                )
                            }
                        }

                        if viewModel.detail?.hasDuration ?? true {
                            HStack {
                                Text("Duration")
                                SelectAllTextField(
                                    placeholder: "Duration",
                                    text: $viewModel.duration,
                                    keyboardType: .numberPad
                                )
                            }
                        }

                        HStack {
                            Text("Reps")
                            SelectAllTextField(
                                placeholder: "Reps",
                                text: $viewModel.reps,
                                keyboardType: .numberPad
                            )
                        }

                        Button("Add Set") {
                            viewModel.addSet()
                        }
                        .disabled(!viewModel.canAddSet)
                    }

                    Section("Sets") {
                        if viewModel.sets.isEmpty {
                            Text("No workout data")
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(Array(viewModel.sets.enumerated()), id: \.element.id) { index, item in
                                HStack {
                                    Text("#\(index + 1)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Spacer()
                                    if viewModel.detail?.hasWeight ?? true {
                                        Text("W \(item.weight)")
                                            .font(.caption)
                                    }
                                    if viewModel.detail?.hasDuration ?? true {
                                        Text("D \(item.duration)")
                                            .font(.caption)
                                    }
                                    Text("R \(item.reps)")
                                        .font(.caption)
                                }
                            }
                            .onDelete(perform: viewModel.removeSets)
                        }
                    }

                    Section("Note") {
                        TextField("Optional note", text: $viewModel.note)
                    }

                    Section {
                        Button {
                            Task {
                                await viewModel.submit()
                            }
                        } label: {
                            if viewModel.isSubmitting {
                                ProgressView()
                                    .frame(maxWidth: .infinity)
                            } else {
                                Text("Submit Workout")
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .disabled(!viewModel.canSubmit)
                    }
                }
                .scrollDismissesKeyboard(.immediately)
            }
        }
        .navigationTitle(viewModel.detail?.name ?? "Exercise")
        .overlay(alignment: .bottom) {
            if let error = viewModel.errorMessage {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.white)
                    .padding()
                    .background(Color.red.opacity(0.9))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .padding()
            }
        }
        .task {
            await viewModel.load()
        }
    }
}

#Preview {
    NavigationStack {
        FitnessExerciseDetailView(exerciseUUID: UUID())
    }
}

private struct SelectAllTextField: UIViewRepresentable {
    let placeholder: String
    @Binding var text: String
    let keyboardType: UIKeyboardType

    func makeUIView(context: Context) -> UITextField {
        let textField = UITextField(frame: .zero)
        textField.placeholder = placeholder
        textField.text = text
        textField.textAlignment = .right
        textField.keyboardType = keyboardType
        textField.delegate = context.coordinator
        textField.addTarget(context.coordinator, action: #selector(Coordinator.textDidChange(_:)), for: .editingChanged)
        return textField
    }

    func updateUIView(_ uiView: UITextField, context: Context) {
        if uiView.text != text {
            uiView.text = text
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    final class Coordinator: NSObject, UITextFieldDelegate {
        var parent: SelectAllTextField

        init(_ parent: SelectAllTextField) {
            self.parent = parent
        }

        @objc func textDidChange(_ textField: UITextField) {
            parent.text = textField.text ?? ""
        }

        func textFieldDidBeginEditing(_ textField: UITextField) {
            DispatchQueue.main.async {
                textField.selectAll(nil)
            }
        }
    }
}
