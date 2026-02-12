import SwiftUI

struct TagSidebarView: View {
    @ObservedObject var viewModel: BookmarkViewModel
    @Binding var isPresented: Bool

    var body: some View {
        NavigationStack {
            List {
                // Untagged section
                Section {
                    Button {
                        selectUntagged()
                    } label: {
                        HStack {
                            Label("Untagged", systemImage: "tray")
                                .foregroundStyle(.primary)

                            Spacer()

                            if case .untagged = viewModel.viewState {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(.blue)
                            }
                        }
                    }
                }

                // Pinned tags section
                Section("Pinned Tags") {
                    if viewModel.pinnedTags.isEmpty {
                        Text("No pinned tags")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(viewModel.pinnedTags) { tag in
                            Button {
                                selectTag(tag)
                            } label: {
                                HStack {
                                    Label(tag.name, systemImage: "tag")
                                        .foregroundStyle(.primary)

                                    Spacer()

                                    Text("\(tag.bookmarkCount)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 2)
                                        .background(Color.gray.opacity(0.2))
                                        .clipShape(Capsule())

                                    if case .tag(let name) = viewModel.viewState, name == tag.name {
                                        Image(systemName: "checkmark")
                                            .foregroundStyle(.blue)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Tags")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        isPresented = false
                    }
                }
            }
            .refreshable {
                await viewModel.loadPinnedTags()
            }
        }
    }

    private func selectUntagged() {
        Task {
            await viewModel.selectUntagged()
            isPresented = false
        }
    }

    private func selectTag(_ tag: PinnedTag) {
        Task {
            await viewModel.selectTag(tag)
            isPresented = false
        }
    }
}

#Preview {
    TagSidebarView(
        viewModel: BookmarkViewModel(),
        isPresented: .constant(true)
    )
}
