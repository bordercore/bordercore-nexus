import SwiftUI

struct TodoFilterSidebarView: View {
    @ObservedObject var viewModel: TodoViewModel
    @Binding var isPresented: Bool

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button {
                        selectAll()
                    } label: {
                        HStack {
                            Label("All Todo", systemImage: "checklist")
                                .foregroundStyle(.primary)

                            Spacer()

                            Text("\(viewModel.allTodos.count)")
                                .font(.caption)
                                .foregroundStyle(.secondary)

                            if case .all = viewModel.viewState {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(.blue)
                            }
                        }
                    }
                }

                Section("Priority") {
                    priorityRow(label: "High", value: 1, icon: "exclamationmark.triangle.fill", color: .red)
                    priorityRow(label: "Medium", value: 2, icon: "exclamationmark.circle.fill", color: .orange)
                    priorityRow(label: "Low", value: 3, icon: "checkmark.circle.fill", color: .green)
                }

                Section("Tags") {
                    if viewModel.tagCounts.isEmpty {
                        Text("No tags")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(viewModel.tagCounts) { tag in
                            Button {
                                selectTag(tag.name)
                            } label: {
                                HStack {
                                    Label(tag.name, systemImage: "tag")
                                        .foregroundStyle(.primary)

                                    Spacer()

                                    Text("\(tag.count)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 2)
                                        .background(Color.gray.opacity(0.2))
                                        .clipShape(Capsule())

                                    if case .tag(let selectedTag) = viewModel.viewState, selectedTag == tag.name {
                                        Image(systemName: "checkmark")
                                            .foregroundStyle(.blue)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Todo Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        isPresented = false
                    }
                }
            }
            .refreshable {
                await viewModel.refresh()
            }
        }
    }

    private func priorityRow(label: String, value: Int, icon: String, color: Color) -> some View {
        Button {
            selectPriority(value)
        } label: {
            HStack {
                Label(label, systemImage: icon)
                    .foregroundStyle(color)

                Spacer()

                Text("\(viewModel.priorityCounts[value, default: 0])")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color.gray.opacity(0.2))
                    .clipShape(Capsule())

                if case .priority(let selectedPriority) = viewModel.viewState, selectedPriority == value {
                    Image(systemName: "checkmark")
                        .foregroundStyle(.blue)
                }
            }
        }
    }

    private func selectAll() {
        viewModel.selectAll()
        isPresented = false
    }

    private func selectPriority(_ priority: Int) {
        viewModel.selectPriority(priority)
        isPresented = false
    }

    private func selectTag(_ tagName: String) {
        viewModel.selectTag(tagName)
        isPresented = false
    }
}

#Preview {
    TodoFilterSidebarView(viewModel: TodoViewModel(), isPresented: .constant(true))
}
