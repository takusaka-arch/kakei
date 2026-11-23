import SwiftUI
import SwiftData

struct BankAccountEditView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    let account: BankAccount?

    @State private var bankName = ""
    @State private var branchName = ""
    @State private var accountType: AccountType = .ordinary
    @State private var note = ""
    @State private var loaded = false
    @State private var confirmingDelete = false

    init(account: BankAccount?) {
        self.account = account
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("口座") {
                    TextField("銀行名（例：三井住友銀行）", text: $bankName)
                    TextField("支店名（任意）", text: $branchName)
                    Picker("種類", selection: $accountType) {
                        ForEach(AccountType.allCases) { item in
                            Text(item.label).tag(item)
                        }
                    }
                }

                Section("メモ") {
                    TextField("メモ", text: $note, axis: .vertical)
                }

                if let account, !account.cards.isEmpty {
                    Section("この口座から引き落とされるカード") {
                        ForEach(account.cards.sorted { $0.name < $1.name }) { card in
                            LabeledContent(card.name, value: card.paymentDay == 0 ? "" : dayLabel(card.paymentDay))
                        }
                    }
                }

                if let account, !account.fixedCosts.isEmpty {
                    Section("この口座から直接引き落とされる固定費") {
                        ForEach(account.fixedCosts.sorted { $0.name < $1.name }) { cost in
                            LabeledContent(cost.name, value: cost.amount.yen)
                        }
                    }
                }

                if account != nil {
                    Section {
                        Button("この口座を削除", role: .destructive) {
                            confirmingDelete = true
                        }
                    }
                }
            }
            .navigationTitle(account == nil ? "口座を追加" : "口座を編集")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") { save() }
                        .disabled(bankName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .confirmationDialog("この口座を削除しますか？", isPresented: $confirmingDelete, titleVisibility: .visible) {
                Button("削除", role: .destructive) {
                    if let account { context.delete(account) }
                    dismiss()
                }
            } message: {
                Text("この口座を使っているカードや固定費は「口座未設定」になります。")
            }
            .onAppear(perform: load)
        }
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        guard let account else { return }
        bankName = account.bankName
        branchName = account.branchName
        accountType = account.accountType
        note = account.note
    }

    private func save() {
        let target: BankAccount
        if let account {
            target = account
        } else {
            target = BankAccount()
            context.insert(target)
        }
        target.bankName = bankName.trimmingCharacters(in: .whitespaces)
        target.branchName = branchName.trimmingCharacters(in: .whitespaces)
        target.accountType = accountType
        target.note = note
        dismiss()
    }
}
