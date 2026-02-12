import SwiftUI

struct TodoMainView: View {
    @StateObject private var viewModel = TodoViewModel()
    @State private var showSidebar = false
    @State private var showNewTodo = false
    @State private var editingTodo: TodoItem?
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
                TodoFilterSidebarView(viewModel: viewModel, isPresented: $showSidebar)
            }
            .sheet(isPresented: $showNewTodo) {
                NewTodoFormView(
                    title: "New Todo",
                    saveButtonTitle: "Create",
                    suggestedTags: viewModel.tagCounts.map(\.name)
                ) { name, note, urlString, tagsCSV, priority, dueDate in
                    await viewModel.createTodo(
                        name: name,
                        note: note,
                        urlString: urlString,
                        tagsCSV: tagsCSV,
                        priority: priority,
                        dueDate: dueDate
                    )
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
        .task {
            await viewModel.loadInitialData()
        }
    }
}

#Preview {
    TodoMainView()
}
