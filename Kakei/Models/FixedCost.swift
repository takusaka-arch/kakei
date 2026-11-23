import Foundation
import SwiftData

/// 固定費（定期的に発生する支払い）
@Model
final class FixedCost {
    /// サービス名（例：妻の携帯通信費）
    var name: String = ""
    /// 1回あたりの金額（円）
    var amount: Int = 0
    var cycleRaw: String = "monthly"
    /// 支払日（0 = 未設定、31 = 末日）
    var paymentDay: Int = 0
    var paymentMethodRaw: String = "bankDebit"
    /// 振込・その他の場合の詳細（振込先など）
    var paymentDetail: String = ""
    var note: String = ""
    var isActive: Bool = true
    var createdAt: Date = Date()

    var category: ExpenseCategory?
    /// 銀行引き落としの場合の口座
    var bankAccount: BankAccount?
    /// クレジットカード払いの場合のカード
    var creditCard: CreditCard?

    init(name: String = "", amount: Int = 0) {
        self.name = name
        self.amount = amount
    }

    var cycle: BillingCycle {
        get { BillingCycle(rawValue: cycleRaw) ?? .monthly }
        set { cycleRaw = newValue.rawValue }
    }

    var paymentMethod: PaymentMethod {
        get { PaymentMethod(rawValue: paymentMethodRaw) ?? .other }
        set { paymentMethodRaw = newValue.rawValue }
    }

    /// 月あたりに換算した金額
    var monthlyAmount: Double {
        Double(amount) / Double(cycle.months)
    }

    /// 年あたりの金額
    var yearlyAmount: Int {
        amount * (12 / cycle.months)
    }

    /// 一覧に表示する支払い方法の詳細
    var paymentSummary: String {
        switch paymentMethod {
        case .bankDebit:
            return bankAccount?.displayName ?? "口座未設定"
        case .creditCard:
            guard let card = creditCard else { return "カード未設定" }
            if let account = card.debitAccount {
                return "\(card.name)（\(account.bankName)）"
            }
            return card.name
        case .bankTransfer, .other:
            return paymentDetail.isEmpty ? paymentMethod.label : paymentDetail
        }
    }
}
