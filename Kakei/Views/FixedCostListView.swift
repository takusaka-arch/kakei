import SwiftUI
import SwiftData

struct FixedCostListView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \FixedCost.name) private var costs: [FixedCost]
    @Query(sort: \ExpenseCategory.sortOrder) private var categories: [ExpenseCategory]

    @State private var isAdding = false
    @State private var editing: FixedCost?

    private struct CostGroup: Identifiable {
        let id: String
        let title: String
        let symbol: String
        let items: [FixedCost]
    }

    private var groups: [CostGroup] {
        var result: [CostGroup] = []
        for (index, category) in categories.enumerated() {
            let items = costs.filter { $0.category === category }
            if !items.isEmpty {
                result.append(CostGroup(id: "c\(index)", title: category.name, symbol: category.iconName, items: items))
            }
        }
        let uncategorized = costs.filter { $0.category == nil }
        if !uncategorized.isEmpty {
            result.append(CostGroup(id: "none", title: "未分類", symbol: "questionmark.folder", items: uncategorized))
        }
        return result
    }

    private var monthlyTotal: Double {
        costs.filter(\.isActive).reduce(0) { $0 + $1.monthlyAmount }
    }

    private var yearlyTotal: Int {
        costs.filter(\.isActive).reduce(0) { $0 + $1.yearlyAmount }
    }

    var body: some View {
        NavigationStack {
            List {
                if !costs.isEmpty {
                    Section {
                        LabeledContent("月あたり", value: monthlyTotal.yen)
                            .font(.headline)
                        LabeledContent("年間", value: yearlyTotal.yen)
                    } footer: {
                        Text("停止中の固定費は含みません。毎月以外の支払いは月あたりに換算しています。")
                    }
                }

                ForEach(groups) { group in
                    Section {
                        ForEach(group.items) { cost in
                            Button {
                                editing = cost
                            } label: {
                                FixedCostRow(cost: cost)
                            }
                            .foregroundStyle(.primary)
                        }
                        .onDelete { offsets in
                            for index in offsets {
                                context.delete(group.items[index])
                            }
                        }
                    } header: {
                        HStack {
                            Label(group.title, systemImage: group.symbol)
                            Spacer()
                            Text(groupMonthly(group.items).yen + " / 月")
                        }
                    }
                }
            }
            .overlay {
                if costs.isEmpty {
                    ContentUnavailableView {
                        Label("固定費がありません", systemImage: "list.bullet.rectangle")
                    } description: {
                        Text("右上の＋から、電気代や携帯代などを登録しましょう。")
                    }
                }
            }
            .navigationTitle("固定費")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        isAdding = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("固定費を追加")
                }
            }
            .sheet(isPresented: $isAdding) {
                FixedCostEditView(cost: nil)
            }
            .sheet(item: $editing) { cost in
                FixedCostEditView(cost: cost)
            }
        }
    }

    private func groupMonthly(_ items: [FixedCost]) -> Double {
        items.filter(\.isActive).reduce(0) { $0 + $1.monthlyAmount }
    }
}
