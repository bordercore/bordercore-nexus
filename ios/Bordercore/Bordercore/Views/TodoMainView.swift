import SwiftUI

struct TodoMainView: View {
    @StateObject private var viewModel = TodoViewModel()
    @State private var showSidebar = false
    @State private var showNewTodo = false
    let onBack: () -> Void

    init(onBack: @escaping () -> Void = {}) {
        self.onBack = onBack
    }

    var body: some View {
        NavigationStack {
            TodoListView(viewModel: viewModel)
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
                    NewTodoFormView { name, note, urlString, tagsCSV, priority, dueDate in
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
        }
        .task {
            await viewModel.loadInitialData()
        }
    }
}

#Preview {
    TodoMainView()
}
