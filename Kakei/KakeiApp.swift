import SwiftUI
import SwiftData

@main
struct KakeiApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: [
            FixedCost.self,
            ExpenseCategory.self,
            BankAccount.self,
            CreditCard.self,
        ])
    }
}
