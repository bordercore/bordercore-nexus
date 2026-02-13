import SwiftUI

struct TodoFormInitialValues {
    let name: String
    let note: String
    let urlString: String
    let tagsCSV: String
    let priority: Int
    let dueDate: Date?
}

struct NewTodoFormView: View {
    private enum Field {
        case name
    }

    @Environment(\.dismiss) private var dismiss

    let title: String
    let saveButtonTitle: String
    let suggestedTags: [String]
    let onSave: (String, String, String, String, Int, Date?) async -> String?

    @State private var name: String
    @State private var note: String
    @State private var urlString: String
    @State private var tagsCSV: String
    @State private var priority: Int
    @State private var hasDueDate: Bool
    @State private var dueDate: Date
    @State private var isSaving = false
    @State private var localError: String?
    @State private var tagSuggestions: [String] = []
    @State private var autocompleteTask: Task<Void, Never>?
    @FocusState private var focusedField: Field?

    init(
        title: String = "New Todo",
        saveButtonTitle: String = "Save",
        initialValues: TodoFormInitialValues? = nil,
        suggestedTags: [String] = [],
        onSave: @escaping (String, String, String, String, Int, Date?) async -> String?
    ) {
        self.title = title
        self.saveButtonTitle = saveButtonTitle
        self.suggestedTags = suggestedTags
        self.onSave = onSave

        let initial = initialValues ?? TodoFormInitialValues(
            name: "",
            note: "",
            urlString: "",
            tagsCSV: "personal",
            priority: 1,
            dueDate: nil
        )

        _name = State(initialValue: initial.name)
        _note = State(initialValue: initial.note)
        _urlString = State(initialValue: initial.urlString)
        _tagsCSV = State(initialValue: initial.tagsCSV)
        _priority = State(initialValue: initial.priority)
        _hasDueDate = State(initialValue: initial.dueDate != nil)
        _dueDate = State(initialValue: initial.dueDate ?? Date())
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Task") {
                    TextField("Name", text: $name)
                        .focused($focusedField, equals: .name)
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

                    if !tagSuggestions.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(tagSuggestions, id: \.self) { suggestion in
                                    Button(suggestion) {
                                        applySuggestion(suggestion)
                                    }
                                    .font(.caption)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(Color.blue.opacity(0.12))
                                    .foregroundStyle(.blue)
                                    .clipShape(Capsule())
                                }
                            }
                            .padding(.vertical, 2)
                        }
                    }

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
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                scheduleTagSuggestions(for: tagsCSV)
                DispatchQueue.main.async {
                    focusedField = .name
                }
            }
            .onDisappear {
                autocompleteTask?.cancel()
            }
            .onChange(of: tagsCSV) { _, newValue in
                scheduleTagSuggestions(for: newValue)
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .disabled(isSaving)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button(isSaving ? "Saving..." : saveButtonTitle) {
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

    private func scheduleTagSuggestions(for rawInput: String) {
        autocompleteTask?.cancel()

        let fragment = currentTagFragment(from: rawInput)
        guard !fragment.isEmpty else {
            tagSuggestions = []
            return
        }

        autocompleteTask = Task {
            try? await Task.sleep(nanoseconds: 200_000_000)
            if Task.isCancelled { return }

            let selected = Set(selectedTags(from: rawInput))

            let local = suggestedTags
                .map { $0.lowercased() }
                .filter { $0.hasPrefix(fragment) && !selected.contains($0) }

            var merged: [String] = []
            var seen = Set<String>()
            for tag in local where seen.insert(tag).inserted {
                merged.append(tag)
            }

            if let token = AuthManager.shared.getToken() {
                if let remote = try? await TagSearchService.shared.searchTags(query: fragment, token: token) {
                    for tag in remote where !selected.contains(tag) && seen.insert(tag).inserted {
                        merged.append(tag)
                    }
                }
            }

            if Task.isCancelled { return }
            await MainActor.run {
                tagSuggestions = Array(merged.prefix(8))
            }
        }
    }

    private func currentTagFragment(from input: String) -> String {
        let parts = input.split(separator: ",", omittingEmptySubsequences: false)
        let last = String(parts.last ?? "")
        return last.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private func selectedTags(from input: String) -> [String] {
        input
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
            .filter { !$0.isEmpty }
    }

    private func applySuggestion(_ suggestion: String) {
        var parts = tagsCSV.split(separator: ",", omittingEmptySubsequences: false).map(String.init)
        if parts.isEmpty {
            tagsCSV = "\(suggestion), "
        } else {
            parts[parts.count - 1] = " \(suggestion)"
            tagsCSV = parts.joined(separator: ",")
            if !tagsCSV.hasSuffix(", ") {
                tagsCSV += ", "
            }
        }
        tagSuggestions = []
    }
}

#Preview {
    NewTodoFormView(suggestedTags: ["work", "ios", "urgent"]) { _, _, _, _, _, _ in
        nil
    }
}
