import Foundation
import SwiftData

/// 固定費のカテゴリー（電気・ガス・通信費など）
@Model
final class ExpenseCategory {
    var name: String = ""
    /// SF Symbols の名前
    var iconName: String = "tag"
    var sortOrder: Int = 0

    @Relationship(deleteRule: .nullify, inverse: \FixedCost.category)
    var fixedCosts: [FixedCost] = []

    init(name: String, iconName: String = "tag", sortOrder: Int = 0) {
        self.name = name
        self.iconName = iconName
        self.sortOrder = sortOrder
    }
}
