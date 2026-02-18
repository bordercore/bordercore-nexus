import SwiftUI

struct TodoMainView: View {
    @StateObject private var viewModel = TodoViewModel()
    @State private var showSidebar = false
    @State private var showNewTodo = false
    @State private var editingTodo: TodoItem?
    @State private var successToastMessage: String?
    @State private var toastDismissTask: Task<Void, Never>?
    let onBack: () -> Void

    init(onBack: @escaping () -> Void = {}) {
        self.onBack = onBack
    }

    var body: some View {
        NavigationStack {
            TodoListView(viewModel: viewModel) { todo in
                editingTodo = todo
            }
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
                            showNewTodo = true
                        } label: {
                            Label("New Todo", systemImage: "plus.circle")
                        }

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
                TodoFilterSidebarView(viewModel: viewModel, isPresented: $showSidebar)
            }
            .sheet(isPresented: $showNewTodo) {
                NewTodoFormView(
                    title: "New Todo",
                    saveButtonTitle: "Create",
                    suggestedTags: viewModel.tagCounts.map(\.name)
                ) { name, note, urlString, tagsCSV, priority, dueDate in
                    let error = await viewModel.createTodo(
                        name: name,
                        note: note,
                        urlString: urlString,
                        tagsCSV: tagsCSV,
                        priority: priority,
                        dueDate: dueDate
                    )
                    if error == nil {
                        showSuccessToast("Todo added")
                    }
                    return error
                }
            }
            .sheet(item: $editingTodo) { todo in
                NewTodoFormView(
                    title: "Edit Todo",
                    saveButtonTitle: "Save",
                    initialValues: TodoFormInitialValues(
                        name: todo.name,
                        note: todo.note ?? "",
                        urlString: todo.url?.absoluteString ?? "",
                        tagsCSV: todo.tags.joined(separator: ","),
                        priority: todo.priority,
                        dueDate: todo.dueDate
                    ),
                    suggestedTags: viewModel.tagCounts.map(\.name)
                ) { name, note, urlString, tagsCSV, priority, dueDate in
                    await viewModel.updateTodo(
                        todo: todo,
                        name: name,
                        note: note,
                        urlString: urlString,
                        tagsCSV: tagsCSV,
                        priority: priority,
                        dueDate: dueDate
                    )
                }
            }
        }
        .overlay(alignment: .bottom) {
            if let message = successToastMessage {
                Text(message)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color.green.opacity(0.95))
                    .clipShape(Capsule())
                    .shadow(color: .black.opacity(0.2), radius: 8, y: 4)
                    .padding(.bottom, 14)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .allowsHitTesting(false)
            }
        }
        .onDisappear {
            toastDismissTask?.cancel()
        }
        .task {
            await viewModel.loadInitialData()
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
    TodoMainView()
}
