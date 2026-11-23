import SwiftUI
import SwiftData

struct ContentView: View {
    @Environment(\.modelContext) private var context

    var body: some View {
        TabView {
            FixedCostListView()
                .tabItem { Label("固定費", systemImage: "list.bullet.rectangle") }
            PaymentSummaryView()
                .tabItem { Label("支払い方法別", systemImage: "chart.bar.doc.horizontal") }
            AccountsAndCardsView()
                .tabItem { Label("カード・口座", systemImage: "creditcard") }
            SettingsView()
                .tabItem { Label("設定", systemImage: "gearshape") }
        }
        .task {
            DefaultData.seedIfNeeded(context)
        }
    }
}
