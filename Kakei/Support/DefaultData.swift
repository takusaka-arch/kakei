import Foundation
import SwiftData

enum DefaultData {
    private static let seededKey = "didSeedDefaultCategories"

    /// 初回起動時に標準カテゴリーを登録する
    static func seedIfNeeded(_ context: ModelContext) {
        let defaults = UserDefaults.standard
        guard !defaults.bool(forKey: seededKey) else { return }

        let existing = (try? context.fetchCount(FetchDescriptor<ExpenseCategory>())) ?? 0
        if existing == 0 {
            let items: [(String, String)] = [
                ("住居", "house.fill"),
                ("電気", "bolt.fill"),
                ("ガス", "flame.fill"),
                ("水道", "drop.fill"),
                ("通信費", "antenna.radiowaves.left.and.right"),
                ("保険", "cross.case.fill"),
                ("サブスク", "play.rectangle.fill"),
                ("教育", "book.fill"),
                ("ローン", "banknote.fill"),
                ("その他", "ellipsis.circle.fill"),
            ]
            for (index, item) in items.enumerated() {
                context.insert(ExpenseCategory(name: item.0, iconName: item.1, sortOrder: index))
            }
            try? context.save()
        }
        defaults.set(true, forKey: seededKey)
    }
}
