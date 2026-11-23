import SwiftUI
import SwiftData

struct FixedCostEditView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @Query(sort: \ExpenseCategory.sortOrder) private var categories: [ExpenseCategory]
    @Query(sort: \BankAccount.bankName) private var accounts: [BankAccount]
    @Query(sort: \CreditCard.name) private var cards: [CreditCard]

    let cost: FixedCost?

    @State private var name = ""
    @State private var amount: Int?
    @State private var cycle: BillingCycle = .monthly
    @State private var paymentDay = 0
    @State private var method: PaymentMethod = .bankDebit
    @State private var category: ExpenseCategory?
    @State private var account: BankAccount?
    @State private var card: CreditCard?
    @State private var paymentDetail = ""
    @State private var note = ""
    @State private var isActive = true
    @State private var loaded = false
    @State private var confirmingDelete = false

    init(cost: FixedCost?) {
        self.cost = cost
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("基本") {
                    TextField("サービス名（例：妻の携帯通信費）", text: $name)
                    Picker("カテゴリー", selection: $category) {
                        Text("未分類").tag(nil as ExpenseCategory?)
                        ForEach(categories) { item in
                            Label(item.name, systemImage: item.iconName).tag(Optional(item))
                        }
                    }
                }

                Section("金額") {
                    HStack {
                        Text("金額")
                        Spacer()
                        TextField("0", value: $amount, format: .number)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                        Text("円")
                    }
                    Picker("周期", selection: $cycle) {
                        ForEach(BillingCycle.allCases) { item in
                            Text(item.label).tag(item)
                        }
                    }
                    DayPicker(title: "支払日", selection: $paymentDay)
                }

                Section("支払い方法") {
                    Picker("方法", selection: $method) {
                        ForEach(PaymentMethod.allCases) { item in
                            Label(item.label, systemImage: item.symbol).tag(item)
                        }
                    }
                    paymentDetailFields
                }

                Section("その他") {
                    Toggle("支払い中", isOn: $isActive)
                    TextField("メモ", text: $note, axis: .vertical)
                }

                if cost != nil {
                    Section {
                        Button("この固定費を削除", role: .destructive) {
                            confirmingDelete = true
                        }
                    }
                }
            }
            .navigationTitle(cost == nil ? "固定費を追加" : "固定費を編集")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { save() }
                        .disabled(!canSave)
                }
            }
            .confirmationDialog("この固定費を削除しますか？", isPresented: $confirmingDelete, titleVisibility: .visible) {
                Button("削除", role: .destructive) {
                    if let cost { context.delete(cost) }
                    dismiss()
                }
            }
            .onAppear(perform: load)
        }
    }

    @ViewBuilder
    private var paymentDetailFields: some View {
        switch method {
        case .bankDebit:
            Picker("引き落とし口座", selection: $account) {
                Text("未選択").tag(nil as BankAccount?)
                ForEach(accounts) { item in
                    Text(item.displayName).tag(Optional(item))
                }
            }
            if accounts.isEmpty {
                Text("「カード・口座」タブで銀行口座を登録すると選べます。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        case .creditCard:
            Picker("カード", selection: $card) {
                Text("未選択").tag(nil as CreditCard?)
                ForEach(cards) { item in
                    Text(item.name).tag(Optional(item))
                }
            }
            if let card {
                LabeledContent("カードの引き落とし口座", value: card.debitAccount?.displayName ?? "未設定")
            }
            if cards.isEmpty {
                Text("「カード・口座」タブでクレジットカードを登録すると選べます。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        case .bankTransfer:
            TextField("振込先（例：〇〇銀行 △△支店 管理会社）", text: $paymentDetail, axis: .vertical)
        case .other:
            TextField("詳細（例：コンビニ払い、PayPay）", text: $paymentDetail, axis: .vertical)
        }
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        guard let cost else { return }
        name = cost.name
        amount = cost.amount
        cycle = cost.cycle
        paymentDay = cost.paymentDay
        method = cost.paymentMethod
        category = cost.category
        account = cost.bankAccount
        card = cost.creditCard
        paymentDetail = cost.paymentDetail
        note = cost.note
        isActive = cost.isActive
    }

    private func save() {
        let target: FixedCost
        if let cost {
            target = cost
        } else {
            target = FixedCost()
            context.insert(target)
        }
        target.name = name.trimmingCharacters(in: .whitespaces)
        target.amount = max(amount ?? 0, 0)
        target.cycle = cycle
        target.paymentDay = paymentDay
        target.paymentMethod = method
        target.category = category
        target.bankAccount = method == .bankDebit ? account : nil
        target.creditCard = method == .creditCard ? card : nil
        target.paymentDetail = (method == .bankTransfer || method == .other) ? paymentDetail : ""
        target.note = note
        target.isActive = isActive
        dismiss()
    }
}
