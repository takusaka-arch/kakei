import Foundation

/// 支払い方法
enum PaymentMethod: String, CaseIterable, Identifiable {
    case bankDebit
    case creditCard
    case bankTransfer
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .bankDebit: "銀行引き落とし"
        case .creditCard: "クレジットカード"
        case .bankTransfer: "振込"
        case .other: "その他"
        }
    }

    var symbol: String {
        switch self {
        case .bankDebit: "building.columns"
        case .creditCard: "creditcard"
        case .bankTransfer: "arrow.left.arrow.right"
        case .other: "ellipsis.circle"
        }
    }
}

/// 支払い周期
enum BillingCycle: String, CaseIterable, Identifiable {
    case monthly
    case bimonthly
    case quarterly
    case semiannual
    case yearly

    var id: String { rawValue }

    var label: String {
        switch self {
        case .monthly: "毎月"
        case .bimonthly: "2か月ごと"
        case .quarterly: "3か月ごと"
        case .semiannual: "半年ごと"
        case .yearly: "毎年"
        }
    }

    /// 何か月に1回支払うか
    var months: Int {
        switch self {
        case .monthly: 1
        case .bimonthly: 2
        case .quarterly: 3
        case .semiannual: 6
        case .yearly: 12
        }
    }
}

/// 口座の種類
enum AccountType: String, CaseIterable, Identifiable {
    case ordinary
    case checking
    case savings

    var id: String { rawValue }

    var label: String {
        switch self {
        case .ordinary: "普通"
        case .checking: "当座"
        case .savings: "貯蓄"
        }
    }
}
