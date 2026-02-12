import SwiftUI

struct NewTodoFormView: View {
    @Environment(\.dismiss) private var dismiss

    let onSave: (String, String, String, String, Int, Date?) async -> String?

    @State private var name = ""
    @State private var note = ""
    @State private var urlString = ""
    @State private var tagsCSV = ""
    @State private var priority = 3
    @State private var hasDueDate = false
    @State private var dueDate = Date()
    @State private var isSaving = false
    @State private var localError: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Task") {
                    TextField("Name", text: $name)
                    TextField("URL", text: $urlString)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    Picker("Priority", selection: $priority) {
                        Text("High").tag(1)
                        Text("Medium").tag(2)
                        Text("Low").tag(3)
                    }
                }

                Section("Tags") {
                    TextField("Comma-separated tags", text: $tagsCSV)
                        .textInputAutocapitalization(.never)
                    Text("Example: work,ios,urgent")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("Schedule") {
                    Toggle("Due date", isOn: $hasDueDate)
                    if hasDueDate {
                        DatePicker("Due", selection: $dueDate, displayedComponents: .date)
                    }
                }

                Section("Notes") {
                    TextEditor(text: $note)
                        .frame(minHeight: 120)
                }

                if let localError {
                    Section {
                        Text(localError)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("New Todo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .disabled(isSaving)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button(isSaving ? "Saving..." : "Save") {
                        Task {
                            await saveTodo()
                        }
                    }
                    .disabled(isSaving || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }

    private func saveTodo() async {
        isSaving = true
        localError = nil

        let error = await onSave(
            name.trimmingCharacters(in: .whitespacesAndNewlines),
            note,
            urlString,
            tagsCSV,
            priority,
            hasDueDate ? dueDate : nil
        )

        isSaving = false

        if let error {
            localError = error
        } else {
            dismiss()
        }
    }
}

#Preview {
    NewTodoFormView { _, _, _, _, _, _ in
        nil
    }
}
