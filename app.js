'use strict';

/* =========================================================
 * 固定費 — 固定費と、カード・引き落とし口座を管理する
 * データはこの端末のブラウザ（localStorage）にだけ保存する。
 * ========================================================= */

const STORAGE_KEY = 'kakei-data-v1';

const PAYMENT_METHODS = {
  bankDebit: { label: '銀行引き落とし', icon: '🏦' },
  creditCard: { label: 'クレジットカード', icon: '💳' },
  bankTransfer: { label: '振込', icon: '🔁' },
  other: { label: 'その他', icon: '📝' },
};

const CYCLES = {
  monthly: { label: '毎月', months: 1 },
  bimonthly: { label: '2か月ごと', months: 2 },
  quarterly: { label: '3か月ごと', months: 3 },
  semiannual: { label: '半年ごと', months: 6 },
  yearly: { label: '毎年', months: 12 },
  multiyear: { label: '数年ごと', months: 12 }, // 実際の月数は years × 12
};

const ACCOUNT_TYPES = { ordinary: '普通', checking: '当座', savings: '貯蓄' };

const DEFAULT_CATEGORIES = [
  ['住居', '🏠'], ['電気', '⚡️'], ['ガス', '🔥'], ['水道', '💧'],
  ['通信費', '📱'], ['保険', '🛡️'], ['サブスク', '🎬'], ['教育', '📚'],
  ['ローン', '💴'], ['その他', '📦'],
];

const EMOJIS = [
  '🏠', '⚡️', '🔥', '💧', '📱', '🌐', '📺', '🛡️', '🏥', '🎬', '🎵', '📚',
  '🎓', '💴', '🚗', '🚃', '🍽️', '🛒', '🐾', '🏋️', '🎁', '☁️', '👶', '📦',
];

/* ---------- データ ---------- */

function emptyData() {
  return {
    version: 1,
    categories: DEFAULT_CATEGORIES.map(([name, icon], i) => ({ id: uid(), name, icon, order: i })),
    accounts: [],
    cards: [],
    costs: [],
  };
}

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) {
    console.error(e);
  }
  const fresh = emptyData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

function normalize(d) {
  return {
    version: 1,
    categories: Array.isArray(d.categories) ? d.categories : [],
    accounts: Array.isArray(d.accounts) ? d.accounts : [],
    cards: Array.isArray(d.cards) ? d.cards : [],
    costs: Array.isArray(d.costs) ? d.costs : [],
  };
}

let db = loadData();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    alert('保存できませんでした: ' + e.message);
  }
  render();
}

const byId = (list, id) => list.find((x) => x.id === id) || null;
const category = (id) => byId(db.categories, id);
const account = (id) => byId(db.accounts, id);
const card = (id) => byId(db.cards, id);
const sortedCategories = () => [...db.categories].sort((a, b) => a.order - b.order);
const sortedAccounts = () => [...db.accounts].sort((a, b) => a.bankName.localeCompare(b.bankName, 'ja'));
const sortedCards = () => [...db.cards].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
const sortedCosts = () => [...db.costs].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
const activeCosts = () => sortedCosts().filter((c) => c.active);

/* ---------- 計算・表示 ---------- */

const months = (cost) =>
  cost.cycle === 'multiyear' ? 12 * (Number(cost.years) || 1) : (CYCLES[cost.cycle] || CYCLES.monthly).months;
// 金額は { lo, hi }（最小・最大）で扱う。幅がない固定費は lo と hi が同じ。
const minAmount = (cost) => Number(cost.amount) || 0;
const maxAmount = (cost) => (cost.isRange ? Math.max(Number(cost.amountMax) || 0, minAmount(cost)) : minAmount(cost));
const amountRange = (cost) => ({ lo: minAmount(cost), hi: maxAmount(cost) });
const scale = (r, k) => ({ lo: r.lo * k, hi: r.hi * k });
const addRange = (a, b) => ({ lo: a.lo + b.lo, hi: a.hi + b.hi });
const ZERO = { lo: 0, hi: 0 };
const monthly = (cost) => scale(amountRange(cost), 1 / months(cost));
const yearly = (cost) => scale(amountRange(cost), 12 / months(cost));
const sumMonthly = (list) => list.reduce((s, c) => addRange(s, monthly(c)), ZERO);
const sumYearly = (list) => list.reduce((s, c) => addRange(s, yearly(c)), ZERO);

const yenFmt = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 });
const yen = (n) => yenFmt.format(Math.round(n));
// 幅のある金額は「¥3,000〜¥5,000」と表示する
const yenRange = (r) => (Math.round(r.lo) === Math.round(r.hi) ? yen(r.lo) : `${yen(r.lo)}〜${yen(r.hi)}`);
const costAmount = (cost) => yenRange(amountRange(cost));

function dayLabel(d) {
  d = Number(d) || 0;
  if (d === 0) return '未設定';
  if (d >= 31) return '末日';
  return `${d}日`;
}

const cycleLabel = (cost) =>
  cost.cycle === 'multiyear' ? `${Number(cost.years) || 1}年ごと` : (CYCLES[cost.cycle] || CYCLES.monthly).label;

// 支払月（1〜12）から、周期に合わせて支払う月の一覧を出す（例：2か月ごと・1月 → 1・3・5・7・9・11月）
function paymentMonths(cycle, month) {
  const step = (CYCLES[cycle] || CYCLES.monthly).months;
  if (!month || step <= 1 || step >= 12) return month ? [month] : [];
  const list = [];
  for (let k = 0; k < 12 / step; k++) list.push(((month - 1 + k * step) % 12) + 1);
  return list.sort((a, b) => a - b);
}

const shortDay = (d) => (Number(d) ? dayLabel(d) : '');

// 一覧に出す「いつ払うか」（例：4月27日、1・3・5・7・9・11月 27日、次回 2028年4月27日）
function scheduleText(cost) {
  const m = Number(cost.paymentMonth) || 0;
  const day = shortDay(cost.paymentDay);
  switch (cost.cycle) {
    case 'bimonthly':
    case 'quarterly':
    case 'semiannual':
      return m ? `${paymentMonths(cost.cycle, m).join('・')}月${day ? ' ' + day : ''}` : day;
    case 'yearly':
      return m ? `${m}月${day}` : day;
    case 'multiyear': {
      const y = Number(cost.nextYear) || 0;
      if (!y && !m) return day;
      return `次回 ${y ? y + '年' : ''}${m ? m + '月' : ''}${day}`;
    }
    default:
      return day;
  }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const accountName = (a) => (a ? (a.branchName ? `${a.bankName} ${a.branchName}` : a.bankName) : '');

function paymentSummary(cost) {
  switch (cost.method) {
    case 'bankDebit': {
      const a = account(cost.accountId);
      return a ? accountName(a) : '口座未設定';
    }
    case 'creditCard': {
      const c = card(cost.cardId);
      if (!c) return 'カード未設定';
      const a = account(c.accountId);
      return a ? `${c.name}（${a.bankName}）` : c.name;
    }
    default:
      return cost.detail || (PAYMENT_METHODS[cost.method] || PAYMENT_METHODS.other).label;
  }
}

function costRow(cost, { showCategory = false, child = false } = {}) {
  const m = PAYMENT_METHODS[cost.method] || PAYMENT_METHODS.other;
  const cat = category(cost.categoryId);
  const schedule = scheduleText(cost);
  const cycleParts = [schedule ? `${cycleLabel(cost)} ${schedule}` : cycleLabel(cost)];
  if (!cost.active) cycleParts.push('停止中');
  return `
    <button class="row${cost.active ? '' : ' inactive'}${child ? ' child' : ''}" data-action="edit-cost" data-id="${cost.id}">
      <div class="main">
        <div class="name">${esc(cost.name)}</div>
        <div class="meta">${m.icon} ${esc(paymentSummary(cost))}${showCategory && cat ? ` ・ ${esc(cat.name)}` : ''}</div>
      </div>
      <div class="right">
        <div class="amount">${costAmount(cost)}</div>
        <div class="meta">${cycleParts.join(' ・ ')}</div>
      </div>
    </button>`;
}

function sectionTitle(left, right = '') {
  return `<div class="section-title"><span>${left}</span><span>${right}</span></div>`;
}

/* ---------- 画面 ---------- */

let currentTab = 'costs';

const TABS = {
  costs: { title: '固定費', render: renderCosts, add: () => openCostSheet(null) },
  summary: { title: '支払い方法別', render: renderSummary },
  wallet: { title: 'カード・口座', render: renderWallet, add: openAddMenu },
  settings: { title: '設定', render: renderSettings },
};

function render() {
  const tab = TABS[currentTab];
  document.getElementById('title').textContent = tab.title;
  document.getElementById('actions').innerHTML = tab.add
    ? '<button class="icon-btn" data-action="add" aria-label="追加">＋</button>'
    : '';
  document.getElementById('view').innerHTML = tab.render();
  document.querySelectorAll('.tabbar button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === currentTab);
  });
}

function renderCosts() {
  const costs = sortedCosts();
  if (costs.length === 0) {
    return `<div class="empty"><div class="big">📋</div>固定費がありません。<br>右上の＋から、電気代や携帯代などを登録しましょう。</div>`;
  }
  const active = costs.filter((c) => c.active);
  let html = `
    <div class="group">
      <div class="row total"><div class="main">月あたり</div><div class="right amount">${yenRange(sumMonthly(active))}</div></div>
      <div class="row"><div class="main">年間</div><div class="right amount">${yenRange(sumYearly(active))}</div></div>
    </div>
    <p class="footnote">停止中の固定費は含みません。毎月以外の支払いは月あたりに換算しています。</p>`;

  const groups = sortedCategories().map((cat) => ({
    title: `${cat.icon} ${esc(cat.name)}`,
    items: costs.filter((c) => c.categoryId === cat.id),
  }));
  groups.push({ title: '❔ 未分類', items: costs.filter((c) => !category(c.categoryId)) });

  for (const g of groups) {
    if (g.items.length === 0) continue;
    html += sectionTitle(g.title, `${yenRange(sumMonthly(g.items.filter((c) => c.active)))} / 月`);
    html += `<div class="group">${g.items.map((c) => costRow(c)).join('')}</div>`;
  }
  return html;
}

function renderSummary() {
  const costs = activeCosts();
  if (costs.length === 0) {
    return `<div class="empty"><div class="big">📊</div>表示する固定費がありません。</div>`;
  }
  const paidByCard = (c) => costs.filter((x) => x.method === 'creditCard' && x.cardId === c.id);

  const cardBlock = (c) => {
    const items = paidByCard(c);
    const info = [`${items.length}件`];
    if (Number(c.paymentDay)) info.push(`${dayLabel(c.paymentDay)}引き落とし`);
    return `
      <details>
        <summary class="row">
          <span class="chev">›</span>
          <div class="main"><div class="name">💳 ${esc(c.name)}</div><div class="meta">${info.join(' ・ ')}</div></div>
          <div class="right amount">${yenRange(sumMonthly(items))}</div>
        </summary>
        ${items.map((x) => costRow(x, { showCategory: true, child: true })).join('')}
      </details>`;
  };

  let html = `<p class="footnote" style="margin-top:0">金額は月あたりに換算しています（年払いは12で割った額）。停止中の固定費は含みません。カードの行をタップすると内訳が開きます。</p>`;

  for (const a of sortedAccounts()) {
    const directs = costs.filter((x) => x.method === 'bankDebit' && x.accountId === a.id);
    const cards = sortedCards().filter((c) => c.accountId === a.id);
    if (directs.length === 0 && cards.length === 0) continue;
    const total = cards.reduce((s, c) => addRange(s, sumMonthly(paidByCard(c))), sumMonthly(directs));
    html += sectionTitle(`🏦 ${esc(accountName(a))}`, `${yenRange(total)} / 月`);
    html += `<div class="group">${directs.map((x) => costRow(x, { showCategory: true })).join('')}${cards.map(cardBlock).join('')}</div>`;
  }

  const looseCards = sortedCards().filter((c) => !account(c.accountId) && paidByCard(c).length > 0);
  if (looseCards.length) {
    html += sectionTitle('引き落とし口座が未設定のカード');
    html += `<div class="group">${looseCards.map(cardBlock).join('')}</div>`;
  }

  for (const method of ['bankTransfer', 'other']) {
    const items = costs.filter((x) => x.method === method);
    if (!items.length) continue;
    const m = PAYMENT_METHODS[method];
    html += sectionTitle(`${m.icon} ${m.label}`, `${yenRange(sumMonthly(items))} / 月`);
    html += `<div class="group">${items.map((x) => costRow(x, { showCategory: true })).join('')}</div>`;
  }

  const unassigned = costs.filter(
    (x) => (x.method === 'bankDebit' && !account(x.accountId)) || (x.method === 'creditCard' && !card(x.cardId))
  );
  if (unassigned.length) {
    html += sectionTitle('⚠️ 口座・カードが未設定', `${yenRange(sumMonthly(unassigned))} / 月`);
    html += `<div class="group">${unassigned.map((x) => costRow(x, { showCategory: true })).join('')}</div>`;
  }
  return html;
}

function renderWallet() {
  let html = sectionTitle('クレジットカード');
  const cards = sortedCards();
  html += '<div class="group">';
  if (!cards.length) html += '<div class="row muted">カードが登録されていません</div>';
  for (const c of cards) {
    const a = account(c.accountId);
    const count = db.costs.filter((x) => x.method === 'creditCard' && x.cardId === c.id).length;
    const sub = [c.brand, c.last4 ? `末尾 ${c.last4}` : ''].filter(Boolean).join(' ・ ');
    html += `
      <button class="row" data-action="edit-card" data-id="${c.id}">
        <div class="main">
          <div class="name">💳 ${esc(c.name)}${sub ? ` <span class="meta">${esc(sub)}</span>` : ''}</div>
          <div class="meta${a ? '' : ' warn'}">↳ ${a ? esc(accountName(a)) : '引き落とし口座 未設定'}${Number(c.paymentDay) ? ` ・ ${dayLabel(c.paymentDay)}` : ''}</div>
        </div>
        <div class="right meta">${count}件</div>
      </button>`;
  }
  html += `<button class="row link" data-action="add-card">＋ クレジットカードを追加</button></div>`;

  html += sectionTitle('銀行口座');
  const accounts = sortedAccounts();
  html += '<div class="group">';
  if (!accounts.length) html += '<div class="row muted">銀行口座が登録されていません</div>';
  for (const a of accounts) {
    const cardCount = db.cards.filter((c) => c.accountId === a.id).length;
    const directCount = db.costs.filter((x) => x.method === 'bankDebit' && x.accountId === a.id).length;
    html += `
      <button class="row" data-action="edit-account" data-id="${a.id}">
        <div class="main">
          <div class="name">🏦 ${esc(accountName(a))} <span class="meta">${ACCOUNT_TYPES[a.type] || ''}</span></div>
          <div class="meta">カード ${cardCount}枚 ・ 直接引き落とし ${directCount}件</div>
        </div>
      </button>`;
  }
  html += `<button class="row link" data-action="add-account">＋ 銀行口座を追加</button></div>`;
  return html;
}

function renderSettings() {
  const cats = sortedCategories();
  let html = sectionTitle('カテゴリー');
  html += '<div class="group">';
  cats.forEach((c, i) => {
    const count = db.costs.filter((x) => x.categoryId === c.id).length;
    html += `
      <div class="row">
        <span class="emoji">${c.icon}</span>
        <button class="main text-btn" style="color:inherit;text-align:left" data-action="edit-category" data-id="${c.id}">${esc(c.name)} <span class="meta">${count}件</span></button>
        <button class="small-btn" data-action="move-category" data-id="${c.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="上へ">↑</button>
        <button class="small-btn" data-action="move-category" data-id="${c.id}" data-dir="1" ${i === cats.length - 1 ? 'disabled' : ''} aria-label="下へ">↓</button>
      </div>`;
  });
  html += `<button class="row link" data-action="add-category">＋ カテゴリーを追加</button></div>`;
  html += `<p class="footnote">名前をタップすると編集・削除できます。カテゴリーを削除すると、その固定費は「未分類」になります。</p>`;

  html += sectionTitle('バックアップ');
  html += `
    <div class="group">
      <button class="row" data-action="export"><div class="main">データを書き出す</div><div class="right meta">JSONファイル</div></button>
      <button class="row" data-action="import"><div class="main">データを読み込む</div><div class="right meta">今のデータは置き換わります</div></button>
    </div>
    <p class="footnote">データはこのiPhoneのブラウザの中だけに保存されます。機種変更やSafariのデータ削除に備えて、ときどき書き出してファイルアプリやiCloud Driveに保存しておくと安心です。</p>
    <input type="file" id="import-file" accept="application/json,.json" hidden>`;

  html += sectionTitle('このアプリについて');
  html += `<div class="group"><div class="row"><div class="main">バージョン</div><div class="right meta">1.2</div></div></div>`;
  return html;
}

/* ---------- シート（編集画面） ---------- */

const sheetEl = document.getElementById('sheet');
let sheetSubmit = null;

function openSheet({ title, body, onSubmit, onDelete, deleteLabel, submitLabel = '保存' }) {
  sheetEl.innerHTML = `
    <form class="sheet" novalidate>
      <div class="sheet-head">
        <button type="button" class="text-btn l" data-action="close-sheet">キャンセル</button>
        <h2>${title}</h2>
        <button type="submit" class="text-btn strong r">${submitLabel}</button>
      </div>
      <div class="sheet-body">
        ${body}
        ${onDelete ? `<button type="button" class="danger-btn" data-action="sheet-delete">${deleteLabel}</button>` : ''}
      </div>
    </form>`;
  sheetEl.hidden = false;
  document.body.style.overflow = 'hidden';
  const form = sheetEl.querySelector('form');
  sheetSubmit = onSubmit;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll('input[type=checkbox]').forEach((cb) => (data[cb.name] = cb.checked));
    if (sheetSubmit(data, form) !== false) closeSheet();
  });
  const del = form.querySelector('[data-action="sheet-delete"]');
  if (del) del.addEventListener('click', () => { if (onDelete() !== false) closeSheet(); });
  return form;
}

function closeSheet() {
  sheetEl.hidden = true;
  sheetEl.innerHTML = '';
  document.body.style.overflow = '';
  sheetSubmit = null;
}

const options = (pairs, selected) =>
  pairs.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(selected ?? '') ? ' selected' : ''}>${esc(l)}</option>`).join('');

function yearOptions(selected) {
  const now = new Date().getFullYear();
  const sel = Number(selected) || now;
  const from = Math.min(now - 1, sel);
  const to = Math.max(now + 10, sel);
  return options(Array.from({ length: to - from + 1 }, (_, i) => [from + i, `${from + i}年`]), sel);
}

const dayOptions = (selected) =>
  options([[0, '未設定'], ...Array.from({ length: 31 }, (_, i) => [i + 1, dayLabel(i + 1)])], selected || 0);

function textField(label, name, value, placeholder = '', extra = '') {
  return `<div class="field stack"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${extra}></div>`;
}
function selectField(label, name, optionsHtml) {
  return `<div class="field"><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}">${optionsHtml}</select></div>`;
}
function noteField(value) {
  return `<div class="field stack"><label for="f-note">メモ</label><textarea id="f-note" name="note" rows="2">${esc(value)}</textarea></div>`;
}

/* 固定費 */
function openCostSheet(cost) {
  const c = cost || { name: '', amount: '', isRange: false, amountMax: '', cycle: 'monthly', paymentDay: 0, paymentMonth: 0, years: 5, nextYear: new Date().getFullYear(), method: 'bankDebit', categoryId: '', accountId: '', cardId: '', detail: '', note: '', active: true };
  const catOpts = [['', '未分類'], ...sortedCategories().map((x) => [x.id, `${x.icon} ${x.name}`])];
  const accOpts = [['', '未選択'], ...sortedAccounts().map((x) => [x.id, accountName(x)])];
  const cardOpts = [['', '未選択'], ...sortedCards().map((x) => [x.id, x.name])];

  const body = `
    ${sectionTitle('基本')}
    <div class="group">
      ${textField('サービス名', 'name', c.name, '例：妻の携帯通信費', 'required autocomplete="off"')}
      ${selectField('カテゴリー', 'categoryId', options(catOpts, c.categoryId))}
    </div>
    ${sectionTitle('金額')}
    <div class="group">
      <div class="field check"><label for="f-isRange">金額に幅がある</label><input type="checkbox" id="f-isRange" name="isRange" ${c.isRange ? 'checked' : ''}></div>
      <div class="field"><label for="f-amount" id="amount-label">金額</label><input id="f-amount" name="amount" type="number" inputmode="numeric" min="0" step="1" value="${esc(c.amount)}" placeholder="0"><span class="unit">円</span></div>
      <div class="field" id="max-row"><label for="f-amountMax">最大</label><input id="f-amountMax" name="amountMax" type="number" inputmode="numeric" min="0" step="1" value="${esc(c.isRange ? c.amountMax : '')}" placeholder="0"><span class="unit">円</span></div>
      ${selectField('周期', 'cycle', options(Object.entries(CYCLES).map(([k, v]) => [k, v.label]), c.cycle))}
      <div id="years-row">${selectField('何年ごと', 'years', options(Array.from({ length: 9 }, (_, i) => [i + 2, `${i + 2}年ごと`]), c.years || 5))}</div>
      <div id="nextyear-row">${selectField('次回の年', 'nextYear', yearOptions(c.nextYear))}</div>
      <div id="month-row">
        ${selectField('支払月', 'paymentMonth', options([[0, '未設定'], ...Array.from({ length: 12 }, (_, i) => [i + 1, `${i + 1}月`])], c.paymentMonth || 0))}
        <div class="field meta" id="month-hint"></div>
      </div>
      ${selectField('支払日', 'paymentDay', dayOptions(c.paymentDay))}
    </div>
    ${sectionTitle('支払い方法')}
    <div class="group">
      ${selectField('方法', 'method', options(Object.entries(PAYMENT_METHODS).map(([k, v]) => [k, `${v.icon} ${v.label}`]), c.method))}
      <div data-show="bankDebit">
        ${selectField('引き落とし口座', 'accountId', options(accOpts, c.accountId))}
        ${db.accounts.length ? '' : '<div class="field meta">「カード・口座」タブで銀行口座を登録すると選べます。</div>'}
      </div>
      <div data-show="creditCard">
        ${selectField('カード', 'cardId', options(cardOpts, c.cardId))}
        <div class="field"><label>カードの引き落とし口座</label><span class="value" id="card-account"></span></div>
        ${db.cards.length ? '' : '<div class="field meta">「カード・口座」タブでクレジットカードを登録すると選べます。</div>'}
      </div>
      <div data-show="bankTransfer other">
        <div class="field stack"><label for="f-detail" id="detail-label">詳細</label><textarea id="f-detail" name="detail" rows="2">${esc(c.detail)}</textarea></div>
      </div>
    </div>
    ${sectionTitle('その他')}
    <div class="group">
      <div class="field check"><label for="f-active">支払い中</label><input type="checkbox" id="f-active" name="active" ${c.active ? 'checked' : ''}></div>
      ${noteField(c.note)}
    </div>`;

  const form = openSheet({
    title: cost ? '固定費を編集' : '固定費を追加',
    body,
    deleteLabel: 'この固定費を削除',
    onDelete: cost
      ? () => {
          if (!confirm(`「${cost.name}」を削除しますか？`)) return false;
          db.costs = db.costs.filter((x) => x.id !== cost.id);
          save();
        }
      : null,
    onSubmit: (d) => {
      const name = d.name.trim();
      if (!name) { alert('サービス名を入力してください'); return false; }
      if (d.isRange && (Number(d.amountMax) || 0) < (Number(d.amount) || 0)) {
        alert('最大の金額は、最小の金額以上にしてください');
        return false;
      }
      const target = cost || { id: uid(), createdAt: Date.now() };
      Object.assign(target, {
        name,
        amount: Math.max(0, Math.round(Number(d.amount) || 0)),
        isRange: d.isRange,
        amountMax: d.isRange ? Math.max(0, Math.round(Number(d.amountMax) || 0)) : 0,
        cycle: d.cycle,
        paymentDay: Number(d.paymentDay) || 0,
        paymentMonth: d.cycle === 'monthly' ? 0 : Number(d.paymentMonth) || 0,
        years: d.cycle === 'multiyear' ? Number(d.years) || 5 : 0,
        nextYear: d.cycle === 'multiyear' ? Number(d.nextYear) || 0 : 0,
        method: d.method,
        categoryId: d.categoryId || '',
        accountId: d.method === 'bankDebit' ? d.accountId : '',
        cardId: d.method === 'creditCard' ? d.cardId : '',
        detail: d.method === 'bankTransfer' || d.method === 'other' ? d.detail : '',
        note: d.note,
        active: d.active,
      });
      if (!cost) db.costs.push(target);
      save();
    },
  });

  const update = () => {
    const method = form.elements.method.value;
    form.querySelectorAll('[data-show]').forEach((el) => {
      el.hidden = !el.dataset.show.split(' ').includes(method);
    });
    const selected = card(form.elements.cardId.value);
    form.querySelector('#card-account').textContent = selected ? accountName(account(selected.accountId)) || '未設定' : '—';
    const detail = form.querySelector('#f-detail');
    form.querySelector('#detail-label').textContent = method === 'bankTransfer' ? '振込先' : '詳細';
    detail.placeholder = method === 'bankTransfer' ? '例：〇〇銀行 △△支店 管理会社' : '例：コンビニ払い、PayPay';
  };
  const updateRange = () => {
    const on = form.elements.isRange.checked;
    form.querySelector('#max-row').hidden = !on;
    form.querySelector('#amount-label').textContent = on ? '最小' : '金額';
  };
  form.elements.isRange.addEventListener('change', updateRange);
  updateRange();

  const updateCycle = () => {
    const cycle = form.elements.cycle.value;
    form.querySelector('#years-row').hidden = cycle !== 'multiyear';
    form.querySelector('#nextyear-row').hidden = cycle !== 'multiyear';
    form.querySelector('#month-row').hidden = cycle === 'monthly';
    const list = paymentMonths(cycle, Number(form.elements.paymentMonth.value));
    const hint = form.querySelector('#month-hint');
    const multi = ['bimonthly', 'quarterly', 'semiannual'].includes(cycle);
    hint.hidden = !multi;
    hint.textContent = list.length ? `支払う月：${list.join('・')}月` : '支払う月のどれか1つを選んでください';
  };
  form.elements.cycle.addEventListener('change', updateCycle);
  form.elements.paymentMonth.addEventListener('change', updateCycle);
  updateCycle();
  form.elements.method.addEventListener('change', update);
  form.elements.cardId.addEventListener('change', update);
  update();
}

/* クレジットカード */
function openCardSheet(c) {
  const x = c || { name: '', brand: '', last4: '', closingDay: 0, paymentDay: 0, accountId: '', note: '' };
  const accOpts = [['', '未選択'], ...sortedAccounts().map((a) => [a.id, accountName(a)])];
  const paid = c ? sortedCosts().filter((y) => y.method === 'creditCard' && y.cardId === c.id) : [];
  const body = `
    ${sectionTitle('カード')}
    <div class="group">
      ${textField('カード名', 'name', x.name, '例：楽天カード', 'required autocomplete="off"')}
      ${textField('ブランド', 'brand', x.brand, '例：VISA', 'autocomplete="off"')}
      ${textField('番号の末尾4桁（任意）', 'last4', x.last4, '1234', 'inputmode="numeric" maxlength="4" pattern="[0-9]*" autocomplete="off"')}
    </div>
    ${sectionTitle('引き落とし')}
    <div class="group">
      ${selectField('引き落とし口座', 'accountId', options(accOpts, x.accountId))}
      ${selectField('締め日', 'closingDay', dayOptions(x.closingDay))}
      ${selectField('引き落とし日', 'paymentDay', dayOptions(x.paymentDay))}
    </div>
    ${db.accounts.length ? '' : '<p class="footnote">先に銀行口座を登録すると、引き落とし口座を選べます。</p>'}
    ${sectionTitle('メモ')}
    <div class="group">${noteField(x.note)}</div>
    ${paid.length ? sectionTitle('このカードで払っている固定費') + `<div class="group">${paid.map((y) => `<div class="row"><div class="main">${esc(y.name)}</div><div class="right amount">${costAmount(y)}</div></div>`).join('')}</div>` : ''}`;

  openSheet({
    title: c ? 'カードを編集' : 'カードを追加',
    body,
    deleteLabel: 'このカードを削除',
    onDelete: c
      ? () => {
          if (!confirm(`「${c.name}」を削除しますか？\nこのカードで払っている固定費は「カード未設定」になります。`)) return false;
          db.cards = db.cards.filter((y) => y.id !== c.id);
          db.costs.forEach((y) => { if (y.cardId === c.id) y.cardId = ''; });
          save();
        }
      : null,
    onSubmit: (d) => {
      const name = d.name.trim();
      if (!name) { alert('カード名を入力してください'); return false; }
      const target = c || { id: uid(), createdAt: Date.now() };
      Object.assign(target, {
        name,
        brand: d.brand.trim(),
        last4: d.last4.replace(/\D/g, '').slice(0, 4),
        accountId: d.accountId,
        closingDay: Number(d.closingDay) || 0,
        paymentDay: Number(d.paymentDay) || 0,
        note: d.note,
      });
      if (!c) db.cards.push(target);
      save();
    },
  });
}

/* 銀行口座 */
function openAccountSheet(a) {
  const x = a || { bankName: '', branchName: '', type: 'ordinary', note: '' };
  const cards = a ? sortedCards().filter((c) => c.accountId === a.id) : [];
  const directs = a ? sortedCosts().filter((y) => y.method === 'bankDebit' && y.accountId === a.id) : [];
  const body = `
    ${sectionTitle('口座')}
    <div class="group">
      ${textField('銀行名', 'bankName', x.bankName, '例：三井住友銀行', 'required autocomplete="off"')}
      ${textField('支店名（任意）', 'branchName', x.branchName, '例：渋谷支店', 'autocomplete="off"')}
      ${selectField('種類', 'type', options(Object.entries(ACCOUNT_TYPES), x.type))}
    </div>
    ${sectionTitle('メモ')}
    <div class="group">${noteField(x.note)}</div>
    ${cards.length ? sectionTitle('この口座から引き落とされるカード') + `<div class="group">${cards.map((c) => `<div class="row"><div class="main">💳 ${esc(c.name)}</div><div class="right meta">${Number(c.paymentDay) ? dayLabel(c.paymentDay) : ''}</div></div>`).join('')}</div>` : ''}
    ${directs.length ? sectionTitle('この口座から直接引き落とされる固定費') + `<div class="group">${directs.map((y) => `<div class="row"><div class="main">${esc(y.name)}</div><div class="right amount">${costAmount(y)}</div></div>`).join('')}</div>` : ''}`;

  openSheet({
    title: a ? '口座を編集' : '口座を追加',
    body,
    deleteLabel: 'この口座を削除',
    onDelete: a
      ? () => {
          if (!confirm(`「${accountName(a)}」を削除しますか？\nこの口座を使っているカードや固定費は「口座未設定」になります。`)) return false;
          db.accounts = db.accounts.filter((y) => y.id !== a.id);
          db.cards.forEach((c) => { if (c.accountId === a.id) c.accountId = ''; });
          db.costs.forEach((y) => { if (y.accountId === a.id) y.accountId = ''; });
          save();
        }
      : null,
    onSubmit: (d) => {
      const bankName = d.bankName.trim();
      if (!bankName) { alert('銀行名を入力してください'); return false; }
      const target = a || { id: uid(), createdAt: Date.now() };
      Object.assign(target, { bankName, branchName: d.branchName.trim(), type: d.type, note: d.note });
      if (!a) db.accounts.push(target);
      save();
    },
  });
}

/* カテゴリー */
function openCategorySheet(cat) {
  let icon = cat ? cat.icon : '📦';
  const body = `
    ${sectionTitle('名前')}
    <div class="group">${textField('カテゴリー名', 'name', cat ? cat.name : '', '例：車', 'required autocomplete="off"')}</div>
    ${sectionTitle('アイコン')}
    <div class="group"><div class="emoji-grid">${EMOJIS.map((e) => `<button type="button" data-emoji="${e}" class="${e === icon ? 'sel' : ''}">${e}</button>`).join('')}</div></div>`;

  const form = openSheet({
    title: cat ? 'カテゴリーを編集' : 'カテゴリーを追加',
    body,
    deleteLabel: 'このカテゴリーを削除',
    onDelete: cat
      ? () => {
          if (!confirm(`「${cat.name}」を削除しますか？\nこのカテゴリーの固定費は「未分類」になります。`)) return false;
          db.categories = db.categories.filter((x) => x.id !== cat.id);
          db.costs.forEach((x) => { if (x.categoryId === cat.id) x.categoryId = ''; });
          save();
        }
      : null,
    onSubmit: (d) => {
      const name = d.name.trim();
      if (!name) { alert('カテゴリー名を入力してください'); return false; }
      if (cat) {
        Object.assign(cat, { name, icon });
      } else {
        const order = Math.max(-1, ...db.categories.map((x) => x.order)) + 1;
        db.categories.push({ id: uid(), name, icon, order });
      }
      save();
    },
  });
  form.querySelector('.emoji-grid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-emoji]');
    if (!b) return;
    icon = b.dataset.emoji;
    form.querySelectorAll('[data-emoji]').forEach((x) => x.classList.toggle('sel', x === b));
  });
}

function moveCategory(id, dir) {
  const cats = sortedCategories();
  const i = cats.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= cats.length) return;
  [cats[i], cats[j]] = [cats[j], cats[i]];
  cats.forEach((c, k) => (c.order = k));
  save();
}

function openAddMenu() {
  openSheet({
    title: '追加',
    submitLabel: '',
    body: `
      <div class="group" style="margin-top:16px">
        <button type="button" class="row" data-action="add-card">💳 クレジットカードを追加</button>
        <button type="button" class="row" data-action="add-account">🏦 銀行口座を追加</button>
      </div>`,
    onSubmit: () => {},
  });
}

/* ---------- バックアップ ---------- */

async function exportData() {
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `kakei-backup-${date}.json`;
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const file = new File([blob], fileName, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.costs)) throw new Error('形式が違います');
      const n = normalize(parsed);
      if (!confirm(`固定費 ${n.costs.length}件、カード ${n.cards.length}枚、口座 ${n.accounts.length}件を読み込みます。\n今のデータは置き換わります。よろしいですか？`)) return;
      db = n;
      save();
      toast('読み込みました');
    } catch (e) {
      alert('読み込めませんでした: ' + e.message);
    }
  };
  reader.readAsText(file);
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}

/* ---------- イベント ---------- */

document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('.tabbar [data-tab]');
  if (tabBtn) {
    currentTab = tabBtn.dataset.tab;
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (e.target === sheetEl) { closeSheet(); return; }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const id = el.dataset.id;
  switch (el.dataset.action) {
    case 'add': TABS[currentTab].add(); break;
    case 'close-sheet': closeSheet(); break;
    case 'edit-cost': openCostSheet(byId(db.costs, id)); break;
    case 'edit-card': openCardSheet(card(id)); break;
    case 'edit-account': openAccountSheet(account(id)); break;
    case 'edit-category': openCategorySheet(category(id)); break;
    case 'add-card': closeSheet(); openCardSheet(null); break;
    case 'add-account': closeSheet(); openAccountSheet(null); break;
    case 'add-category': openCategorySheet(null); break;
    case 'move-category': moveCategory(id, Number(el.dataset.dir)); break;
    case 'export': exportData(); break;
    case 'import': document.getElementById('import-file').click(); break;
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'import-file' && e.target.files[0]) {
    importData(e.target.files[0]);
    e.target.value = '';
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !sheetEl.hidden) closeSheet();
});

render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker:', err));
  });
}

// 「ホーム画面に追加」したアプリのデータを、ブラウザが勝手に消さないように頼む
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}
