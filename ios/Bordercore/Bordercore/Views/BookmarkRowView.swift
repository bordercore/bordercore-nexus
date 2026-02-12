import SwiftUI

struct BookmarkRowView: View {
    let bookmark: Bookmark

    var body: some View {
        Button {
            openURL()
        } label: {
            HStack(alignment: .top, spacing: 12) {
                // Thumbnail
                AsyncImage(url: bookmark.thumbnailUrl) { phase in
                    switch phase {
                    case .empty:
                        thumbnailPlaceholder
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 80, height: 60)
                            .clipped()
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                    case .failure:
                        thumbnailPlaceholder
                    @unknown default:
                        thumbnailPlaceholder
                    }
                }

                // Content
                VStack(alignment: .leading, spacing: 4) {
                    // Favicon + Title
                    HStack(alignment: .top, spacing: 6) {
                        if let faviconUrl = bookmark.faviconUrl,
                           let url = URL(string: faviconUrl) {
                            AsyncImage(url: url) { phase in
                                switch phase {
                                case .success(let image):
                                    image
                                        .resizable()
                                        .frame(width: 16, height: 16)
                                default:
                                    EmptyView()
                                }
                            }
                        }

                        Text(bookmark.name)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundStyle(.primary)
                            .lineLimit(2)
                    }

                    // URL host
                    if let host = bookmark.url.host {
                        Text(host)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    // Tags
                    if !bookmark.tags.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 4) {
                                ForEach(bookmark.tags, id: \.self) { tag in
                                    Text(tag)
                                        .font(.caption2)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.blue.opacity(0.1))
                                        .foregroundStyle(.blue)
                                        .clipShape(Capsule())
                                }
                            }
                        }
                    }

                    // Note
                    if let note = bookmark.note, !note.isEmpty {
                        Text(note)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }

                    // Video duration badge
                    if let duration = bookmark.videoDuration, !duration.isEmpty {
                        HStack(spacing: 4) {
                            Image(systemName: "play.fill")
                                .font(.caption2)
                            Text(duration)
                                .font(.caption2)
                        }
                        .foregroundStyle(.secondary)
                    }
                }

                Spacer(minLength: 0)

                // Indicators
                VStack(spacing: 4) {
                    if bookmark.isPinned {
                        Image(systemName: "pin.fill")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }

                    if bookmark.importance > 1 {
                        Image(systemName: "star.fill")
                            .font(.caption)
                            .foregroundStyle(.yellow)
                    }

                    // Status indicator
                    if let code = bookmark.lastResponseCode {
                        Circle()
                            .fill(statusColor(for: code))
                            .frame(width: 8, height: 8)
                    }
                }
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
    }

    private var thumbnailPlaceholder: some View {
        RoundedRectangle(cornerRadius: 6)
            .fill(Color.gray.opacity(0.2))
            .frame(width: 80, height: 60)
            .overlay {
                Image(systemName: "bookmark")
                    .foregroundStyle(.gray)
            }
    }

    private func statusColor(for code: Int) -> Color {
        switch code {
        case 200...299:
            return .green
        case 300...399:
            return .yellow
        case 400...599:
            return .red
        default:
            return .gray
        }
    }

    private func openURL() {
        UIApplication.shared.open(bookmark.url)
    }
}

#Preview {
    List {
        BookmarkRowView(
            bookmark: Bookmark(
                uuid: UUID(),
                name: "Example Bookmark with a Long Title That Wraps",
                url: URL(string: "https://example.com/page")!,
                note: "This is a note about the bookmark",
                thumbnailUrl: nil,
                faviconUrl: nil,
                tags: ["swift", "ios", "development"],
                created: Date(),
                isPinned: true,
                importance: 5,
                videoDuration: "12:34",
                lastResponseCode: 200,
                sortOrder: nil,
                tagNote: nil
            )
        )
    }
    .listStyle(.plain)
}

// Extension for preview convenience
extension Bookmark {
    init(
        uuid: UUID,
        name: String,
        url: URL,
        note: String?,
        thumbnailUrl: URL?,
        faviconUrl: String?,
        tags: [String],
        created: Date,
        isPinned: Bool,
        importance: Int,
        videoDuration: String?,
        lastResponseCode: Int?,
        sortOrder: Int?,
        tagNote: String?
    ) {
        self.uuid = uuid
        self.name = name
        self.url = url
        self.note = note
        self.thumbnailUrl = thumbnailUrl
        self.faviconUrl = faviconUrl
        self.tags = tags
        self.created = created
        self.isPinned = isPinned
        self.importance = importance
        self.videoDuration = videoDuration
        self.lastResponseCode = lastResponseCode
        self.sortOrder = sortOrder
        self.tagNote = tagNote
    }
}
