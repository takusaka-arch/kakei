import SwiftUI
import SwiftData

struct CreditCardEditView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \BankAccount.bankName) private var accounts: [BankAccount]

    let card: CreditCard?

    @State private var name = ""
    @State private var brand = ""
    @State private var last4 = ""
    @State private var closingDay = 0
    @State private var paymentDay = 0
    @State private var debitAccount: BankAccount?
    @State private var note = ""
    @State private var loaded = false
    @State private var confirmingDelete = false

    init(card: CreditCard?) {
        self.card = card
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("カード") {
                    TextField("カード名（例：楽天カード）", text: $name)
                    TextField("ブランド（例：VISA）", text: $brand)
                    TextField("番号の末尾4桁（任意）", text: $last4)
                        .keyboardType(.numberPad)
                        .onChange(of: last4) { _, newValue in
                            let digits = String(newValue.filter(\.isNumber).prefix(4))
                            if digits != newValue { last4 = digits }
                        }
                }

                Section {
                    Picker("引き落とし口座", selection: $debitAccount) {
                        Text("未選択").tag(nil as BankAccount?)
                        ForEach(accounts) { item in
                            Text(item.displayName).tag(Optional(item))
                        }
                    }
                    DayPicker(title: "締め日", selection: $closingDay)
                    DayPicker(title: "引き落とし日", selection: $paymentDay)
                } header: {
                    Text("引き落とし")
                } footer: {
                    if accounts.isEmpty {
                        Text("先に銀行口座を登録すると、引き落とし口座を選べます。")
                    }
                }

                Section("メモ") {
                    TextField("メモ", text: $note, axis: .vertical)
                }

                if let card, !card.fixedCosts.isEmpty {
                    Section("このカードで払っている固定費") {
                        ForEach(card.fixedCosts.sorted { $0.name < $1.name }) { cost in
                            LabeledContent(cost.name, value: cost.amount.yen)
                        }
                    }
                }

                if card != nil {
                    Section {
                        Button("このカードを削除", role: .destructive) {
                            confirmingDelete = true
                        }
                    }
                }
            }
            .navigationTitle(card == nil ? "カードを追加" : "カードを編集")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { save() }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .confirmationDialog("このカードを削除しますか？", isPresented: $confirmingDelete, titleVisibility: .visible) {
                Button("削除", role: .destructive) {
                    if let card { context.delete(card) }
                    dismiss()
                }
            } message: {
                Text("このカードで払っている固定費は「カード未設定」になります。")
            }
            .onAppear(perform: load)
        }
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        guard let card else { return }
        name = card.name
        brand = card.brand
        last4 = card.last4
        closingDay = card.closingDay
        paymentDay = card.paymentDay
        debitAccount = card.debitAccount
        note = card.note
    }

    private func save() {
        let target: CreditCard
        if let card {
            target = card
        } else {
            target = CreditCard()
            context.insert(target)
        }
        target.name = name.trimmingCharacters(in: .whitespaces)
        target.brand = brand
        target.last4 = last4
        target.closingDay = closingDay
        target.paymentDay = paymentDay
        target.debitAccount = debitAccount
        target.note = note
        dismiss()
    }
}
