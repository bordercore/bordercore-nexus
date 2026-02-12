import SwiftUI

struct TodoRowView: View {
    let todo: TodoItem

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 8) {
                Text(todo.name)
                    .font(.headline)
                    .foregroundStyle(.primary)
                    .lineLimit(3)

                Spacer(minLength: 0)

                Text(todo.priorityName)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(priorityColor.opacity(0.15))
                    .foregroundStyle(priorityColor)
                    .clipShape(Capsule())
            }

            if !todo.tags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 4) {
                        ForEach(todo.tags, id: \.self) { tag in
                            Text(tag)
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.blue.opacity(0.12))
                                .foregroundStyle(.blue)
                                .clipShape(Capsule())
                        }
                    }
                }
            }

            if let note = todo.note, !note.isEmpty {
                Text(note)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }

            HStack(spacing: 10) {
                if let dueDate = todo.dueDate {
                    Label(dueDate.formatted(date: .abbreviated, time: .omitted), systemImage: "calendar")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if todo.url != nil {
                    Label("Link", systemImage: "link")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture {
            openURLIfPresent()
        }
    }

    private var priorityColor: Color {
        switch todo.priority {
        case 1:
            return .red
        case 2:
            return .orange
        default:
            return .green
        }
    }

    private func openURLIfPresent() {
        guard let url = todo.url else { return }
        UIApplication.shared.open(url)
    }
}

#Preview {
    List {
        TodoRowView(
            todo: TodoItem(
                uuid: UUID(),
                name: "Ship iOS splash screen",
                note: "Add splash navigation and todo list filter menu.",
                tags: ["ios", "swiftui"],
                priority: 1,
                url: URL(string: "https://example.com"),
                dueDate: .now
            )
        )
    }
}

private extension TodoItem {
    init(
        uuid: UUID,
        name: String,
        note: String?,
        tags: [String],
        priority: Int,
        url: URL?,
        dueDate: Date?
    ) {
        self.uuid = uuid
        self.name = name
        self.note = note
        self.tags = tags
        self.priority = priority
        self.url = url
        self.dueDate = dueDate
    }
}
