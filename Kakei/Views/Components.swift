import SwiftUI

/// 日付（1〜31日）を選ぶピッカー
struct DayPicker: View {
    let title: String
    @Binding var selection: Int

    var body: some View {
        Picker(title, selection: $selection) {
            Text("未設定").tag(0)
            ForEach(1...31, id: \.self) { day in
                Text(dayLabel(day)).tag(day)
            }
        }
    }
}

/// 固定費1件の行
struct FixedCostRow: View {
    let cost: FixedCost
    var showsCategory = false

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 4) {
                Text(cost.name)
                    .font(.body)
                HStack(spacing: 4) {
                    Image(systemName: cost.paymentMethod.symbol)
                    Text(cost.paymentSummary)
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                if showsCategory, let category = cost.category {
                    Text(category.name)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text(cost.amount.yen)
                    .font(.body.monospacedDigit())
                Text(cycleText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .opacity(cost.isActive ? 1 : 0.4)
    }

    private var cycleText: String {
        var parts = [cost.cycle.label]
        if cost.paymentDay != 0 { parts.append(dayLabel(cost.paymentDay)) }
        if !cost.isActive { parts.append("停止中") }
        return parts.joined(separator: " ・ ")
    }
}
