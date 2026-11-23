import SwiftUI
import SwiftData

/// 口座・カードごとに「何がいくら落ちるか」をまとめる画面
struct PaymentSummaryView: View {
    @Query(sort: \FixedCost.name) private var allCosts: [FixedCost]
    @Query(sort: \BankAccount.bankName) private var accounts: [BankAccount]
    @Query(sort: \CreditCard.name) private var cards: [CreditCard]

    @State private var editing: FixedCost?

    private var activeCosts: [FixedCost] { allCosts.filter(\.isActive) }

    private func directDebits(of account: BankAccount) -> [FixedCost] {
        activeCosts.filter { $0.paymentMethod == .bankDebit && $0.bankAccount === account }
    }

    private func costsPaid(with card: CreditCard) -> [FixedCost] {
        activeCosts.filter { $0.paymentMethod == .creditCard && $0.creditCard === card }
    }

    private func cardsDebited(from account: BankAccount) -> [CreditCard] {
        cards.filter { $0.debitAccount === account }
    }

    private func total(_ items: [FixedCost]) -> Double {
        items.reduce(0) { $0 + $1.monthlyAmount }
    }

    private func total(of account: BankAccount) -> Double {
        total(directDebits(of: account)) + cardsDebited(from: account).reduce(0) { $0 + total(costsPaid(with: $1)) }
    }

    private var cardsWithoutAccount: [CreditCard] {
        cards.filter { $0.debitAccount == nil && !costsPaid(with: $0).isEmpty }
    }

    private var unassigned: [FixedCost] {
        activeCosts.filter {
            ($0.paymentMethod == .bankDebit && $0.bankAccount == nil)
                || ($0.paymentMethod == .creditCard && $0.creditCard == nil)
        }
    }

    private func costsPaid(by method: PaymentMethod) -> [FixedCost] {
        activeCosts.filter { $0.paymentMethod == method }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("金額は月あたりに換算しています（年払いは12で割った額）。停止中の固定費は含みません。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                ForEach(accounts) { account in
                    let directs = directDebits(of: account)
                    let linkedCards = cardsDebited(from: account)
                    if !directs.isEmpty || !linkedCards.isEmpty {
                        Section {
                            ForEach(directs) { cost in
                                costButton(cost)
                            }
                            ForEach(linkedCards) { card in
                                cardGroup(card)
                            }
                        } header: {
                            totalHeader(account.displayName, symbol: "building.columns", amount: total(of: account))
                        }
                    }
                }

                if !cardsWithoutAccount.isEmpty {
                    Section {
                        ForEach(cardsWithoutAccount) { card in
                            cardGroup(card)
                        }
                    } header: {
                        Text("引き落とし口座が未設定のカード")
                    }
                }

                simpleSection("振込", method: .bankTransfer)
                simpleSection("その他", method: .other)

                if !unassigned.isEmpty {
                    Section {
                        ForEach(unassigned) { cost in
                            costButton(cost)
                        }
                    } header: {
                        totalHeader("口座・カードが未設定", symbol: "exclamationmark.triangle", amount: total(unassigned))
                    }
                }
            }
            .overlay {
                if activeCosts.isEmpty {
                    ContentUnavailableView("表示する固定費がありません", systemImage: "chart.bar.doc.horizontal")
                }
            }
            .navigationTitle("支払い方法別")
            .sheet(item: $editing) { cost in
                FixedCostEditView(cost: cost)
            }
        }
    }

    @ViewBuilder
    private func simpleSection(_ title: String, method: PaymentMethod) -> some View {
        let items = costsPaid(by: method)
        if !items.isEmpty {
            Section {
                ForEach(items) { cost in
                    costButton(cost)
                }
            } header: {
                totalHeader(title, symbol: method.symbol, amount: total(items))
            }
        }
    }

    private func cardGroup(_ card: CreditCard) -> some View {
        let items = costsPaid(with: card)
        return DisclosureGroup {
            ForEach(items) { cost in
                costButton(cost)
            }
        } label: {
            HStack {
                Label(card.name, systemImage: "creditcard")
                Spacer()
                VStack(alignment: .trailing) {
                    Text(total(items).yen)
                        .monospacedDigit()
                    Text("\(items.count)件" + (card.paymentDay != 0 ? " ・ \(dayLabel(card.paymentDay))引き落とし" : ""))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func costButton(_ cost: FixedCost) -> some View {
        Button {
            editing = cost
        } label: {
            FixedCostRow(cost: cost, showsCategory: true)
        }
        .foregroundStyle(.primary)
    }

    private func totalHeader(_ title: String, symbol: String, amount: Double) -> some View {
        HStack {
            Label(title, systemImage: symbol)
            Spacer()
            Text(amount.yen + " / 月")
        }
    }
}
