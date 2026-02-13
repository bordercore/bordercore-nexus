import SwiftUI

struct BookmarkListView: View {
    @ObservedObject var viewModel: BookmarkViewModel

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.bookmarks.isEmpty {
                ProgressView("Loading...")
            } else if viewModel.bookmarks.isEmpty {
                ContentUnavailableView(
                    "No Bookmarks",
                    systemImage: "bookmark.slash",
                    description: Text("No bookmarks found for this view")
                )
            } else {
                List {
                    ForEach(viewModel.bookmarks) { bookmark in
                        BookmarkRowView(bookmark: bookmark)
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    Task {
                                        await viewModel.deleteBookmark(bookmark)
                                    }
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                                .tint(.red)
                            }
                    }
                }
                .listStyle(.plain)
                .refreshable {
                    await viewModel.refresh()
                }
            }
        }
        .overlay {
            if let error = viewModel.errorMessage {
                VStack {
                    Spacer()
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.white)
                        .padding()
                        .background(Color.red.opacity(0.9))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .padding()
                }
                .transition(.move(edge: .bottom))
                .animation(.easeInOut, value: viewModel.errorMessage)
            }
        }
    }
}

#Preview {
    NavigationStack {
        BookmarkListView(viewModel: BookmarkViewModel())
            .navigationTitle("Bookmarks")
    }
}
