import Foundation

extension Int {
    var yen: String {
        formatted(.currency(code: "JPY"))
    }
}

extension Double {
    var yen: String {
        formatted(.currency(code: "JPY").precision(.fractionLength(0)))
    }
}

/// 日付（1〜31）の表示。0 は未設定、31 は末日。
func dayLabel(_ day: Int) -> String {
    switch day {
    case 0: "未設定"
    case 31...: "末日"
    default: "\(day)日"
    }
}
