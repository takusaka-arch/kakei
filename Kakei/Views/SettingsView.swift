import SwiftUI
import SwiftData

struct SettingsView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \ExpenseCategory.sortOrder) private var categories: [ExpenseCategory]

    @State private var adding = false
    @State private var editing: ExpenseCategory?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(categories) { category in
                        Button {
                            editing = category
                        } label: {
                            HStack {
                                Label(category.name, systemImage: category.iconName)
                                Spacer()
                                Text("\(category.fixedCosts.count)件")
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .foregroundStyle(.primary)
                    }
                    .onDelete { offsets in
                        for index in offsets { context.delete(categories[index]) }
                    }
                    .onMove(perform: move)

                    Button {
                        adding = true
                    } label: {
                        Label("カテゴリーを追加", systemImage: "plus")
                    }
                } header: {
                    Text("カテゴリー")
                } footer: {
                    Text("カテゴリーを削除すると、その固定費は「未分類」になります。")
                }

                Section("このアプリについて") {
                    LabeledContent("バージョン", value: appVersion)
                    Text("データはこのiPhoneの中だけに保存されます。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("設定")
            .toolbar {
                EditButton()
            }
            .sheet(isPresented: $adding) {
                CategoryEditView(category: nil, nextSortOrder: (categories.map(\.sortOrder).max() ?? -1) + 1)
            }
            .sheet(item: $editing) { category in
                CategoryEditView(category: category, nextSortOrder: category.sortOrder)
            }
        }
    }

    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "-"
    }

    private func move(from source: IndexSet, to destination: Int) {
        var items = categories
        items.move(fromOffsets: source, toOffset: destination)
        for (index, item) in items.enumerated() {
            item.sortOrder = index
        }
    }
}

struct CategoryEditView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    let category: ExpenseCategory?
    let nextSortOrder: Int

    @State private var name = ""
    @State private var iconName = "tag"
    @State private var loaded = false

    private let icons = [
        "house.fill", "bolt.fill", "flame.fill", "drop.fill",
        "antenna.radiowaves.left.and.right", "iphone", "wifi", "tv.fill",
        "cross.case.fill", "heart.fill", "play.rectangle.fill", "music.note",
        "book.fill", "graduationcap.fill", "banknote.fill", "car.fill",
        "tram.fill", "fork.knife", "cart.fill", "pawprint.fill",
        "figure.run", "gift.fill", "cloud.fill", "tag", "ellipsis.circle.fill",
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("名前") {
                    TextField("カテゴリー名", text: $name)
                }
                Section("アイコン") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 5), spacing: 16) {
                        ForEach(icons, id: \.self) { icon in
                            Button {
                                iconName = icon
                            } label: {
                                Image(systemName: icon)
                                    .font(.title3)
                                    .frame(width: 44, height: 44)
                                    .background(
                                        Circle().fill(iconName == icon ? Color.accentColor.opacity(0.2) : Color.clear)
                                    )
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(icon)
                        }
                    }
                    .padding(.vertical, 8)
                }
            }
            .navigationTitle(category == nil ? "カテゴリーを追加" : "カテゴリーを編集")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { save() }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear {
                guard !loaded else { return }
                loaded = true
                if let category {
                    name = category.name
                    iconName = category.iconName
                }
            }
        }
    }

    private func save() {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        if let category {
            category.name = trimmed
            category.iconName = iconName
        } else {
            context.insert(ExpenseCategory(name: trimmed, iconName: iconName, sortOrder: nextSortOrder))
        }
        dismiss()
    }
}
