import SwiftUI

struct TodoListView: View {
    @ObservedObject var viewModel: TodoViewModel

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.todos.isEmpty {
                ProgressView("Loading...")
            } else if viewModel.todos.isEmpty {
                ContentUnavailableView(
                    "No Todo Items",
                    systemImage: "checklist",
                    description: Text("No todo items found for this filter")
                )
            } else {
                List {
                    ForEach(viewModel.todos) { todo in
                        TodoRowView(todo: todo)
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) {
                                    Task {
                                        await viewModel.deleteTodo(todo)
                                    }
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                    }
                }
                .listStyle(.plain)
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
        TodoListView(viewModel: TodoViewModel())
            .navigationTitle("Todo")
    }
}
