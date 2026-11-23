import Foundation
import SwiftData

/// 銀行口座
@Model
final class BankAccount {
    var bankName: String = ""
    var branchName: String = ""
    var accountTypeRaw: String = "ordinary"
    var note: String = ""
    var createdAt: Date = Date()

    /// この口座から引き落とされるクレジットカード
    @Relationship(deleteRule: .nullify, inverse: \CreditCard.debitAccount)
    var cards: [CreditCard] = []

    /// この口座から直接引き落とされる固定費
    @Relationship(deleteRule: .nullify, inverse: \FixedCost.bankAccount)
    var fixedCosts: [FixedCost] = []

    init(bankName: String = "", branchName: String = "") {
        self.bankName = bankName
        self.branchName = branchName
    }

    var accountType: AccountType {
        get { AccountType(rawValue: accountTypeRaw) ?? .ordinary }
        set { accountTypeRaw = newValue.rawValue }
    }

    var displayName: String {
        branchName.isEmpty ? bankName : "\(bankName) \(branchName)"
    }
}
