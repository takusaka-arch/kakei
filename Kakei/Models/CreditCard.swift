import Foundation
import SwiftData

/// クレジットカード
@Model
final class CreditCard {
    var name: String = ""
    var brand: String = ""
    var last4: String = ""
    /// 締め日（0 = 未設定、31 = 末日）
    var closingDay: Int = 0
    /// 引き落とし日（0 = 未設定、31 = 末日）
    var paymentDay: Int = 0
    var note: String = ""
    var createdAt: Date = Date()

    /// このカードの代金が引き落とされる銀行口座
    var debitAccount: BankAccount?

    /// このカードで支払っている固定費
    @Relationship(deleteRule: .nullify, inverse: \FixedCost.creditCard)
    var fixedCosts: [FixedCost] = []

    init(name: String = "") {
        self.name = name
    }

    var subtitle: String {
        [brand, last4.isEmpty ? "" : "末尾 \(last4)"]
            .filter { !$0.isEmpty }
            .joined(separator: " ・ ")
    }
}
