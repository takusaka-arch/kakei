import SwiftUI
import SwiftData

/// クレジットカードと銀行口座の一覧（カード → 引き落とし口座の対応表）
struct AccountsAndCardsView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \CreditCard.name) private var cards: [CreditCard]
    @Query(sort: \BankAccount.bankName) private var accounts: [BankAccount]

    @State private var addingCard = false
    @State private var addingAccount = false
    @State private var editingCard: CreditCard?
    @State private var editingAccount: BankAccount?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(cards) { card in
                        Button {
                            editingCard = card
                        } label: {
                            cardRow(card)
                        }
                        .foregroundStyle(.primary)
                    }
                    .onDelete { offsets in
                        for index in offsets { context.delete(cards[index]) }
                    }
                    if cards.isEmpty {
                        Text("カードが登録されていません")
                            .foregroundStyle(.secondary)
                    }
                } header: {
                    Text("クレジットカード")
                }

                Section {
                    ForEach(accounts) { account in
                        Button {
                            editingAccount = account
                        } label: {
                            accountRow(account)
                        }
                        .foregroundStyle(.primary)
                    }
                    .onDelete { offsets in
                        for index in offsets { context.delete(accounts[index]) }
                    }
                    if accounts.isEmpty {
                        Text("銀行口座が登録されていません")
                            .foregroundStyle(.secondary)
                    }
                } header: {
                    Text("銀行口座")
                }
            }
            .navigationTitle("カード・口座")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button {
                            addingCard = true
                        } label: {
                            Label("クレジットカードを追加", systemImage: "creditcard")
                        }
                        Button {
                            addingAccount = true
                        } label: {
                            Label("銀行口座を追加", systemImage: "building.columns")
                        }
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("追加")
                }
            }
            .sheet(isPresented: $addingCard) { CreditCardEditView(card: nil) }
            .sheet(isPresented: $addingAccount) { BankAccountEditView(account: nil) }
            .sheet(item: $editingCard) { CreditCardEditView(card: $0) }
            .sheet(item: $editingAccount) { BankAccountEditView(account: $0) }
        }
    }

    private func cardRow(_ card: CreditCard) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Image(systemName: "creditcard")
                Text(card.name)
                if !card.subtitle.isEmpty {
                    Text(card.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            HStack(spacing: 4) {
                Image(systemName: "arrow.turn.down.right")
                Text(card.debitAccount?.displayName ?? "引き落とし口座 未設定")
                if card.paymentDay != 0 {
                    Text("・ \(dayLabel(card.paymentDay))")
                }
                Spacer()
                Text("\(card.fixedCosts.count)件")
            }
            .font(.caption)
            .foregroundStyle(card.debitAccount == nil ? .orange : .secondary)
        }
    }

    private func accountRow(_ account: BankAccount) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Image(systemName: "building.columns")
                Text(account.displayName)
                Text(account.accountType.label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Text("カード \(account.cards.count)枚 ・ 直接引き落とし \(account.fixedCosts.count)件")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}
