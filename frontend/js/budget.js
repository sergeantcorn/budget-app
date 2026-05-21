// ============================================================
// BUDGET PAGE
// ============================================================

function renderBudget() {
  if (!appData) return;
  const active = appData.activeBudget;
  const el     = document.getElementById('budget-content');

  if (!active) {
    el.innerHTML = `
      <div class="empty">No active budget found.<br>Set up your first period below.</div>
      <button class="btn btn-primary" style="width:100%;margin-top:16px" onclick="openPeriodModal(null)">Set Up Period</button>`;
    return;
  }

  const overrides        = active.overrides_json || {};
  const calculatedBills  = calcBills(appData.regularPayments, active.period_start, active.period_end, overrides);
  const oneoffs          = active.oneoff_json || [];
  budgetBills            = calculatedBills;
  const summary          = calcSummary(calculatedBills, oneoffs, active.income);
  const spaceOrder       = ['Bills','Groceries','Secondary Bills','Savings','Adhoc','Misc'];

  let html = '';

  // Period bar
  html += `<div class="date-bar">
    <div class="dates">
      <span>${fmtDate(active.period_start)}</span>
      <span class="arrow">→</span>
      <span>${fmtDate(active.period_end)}</span>
    </div>
    <button class="btn-ghost" onclick="openPeriodModal(${JSON.stringify(active).split('"').join('&quot;')})">Edit</button>
  </div>`;

  // Income
  html += `<div class="income-card">
    <div class="ic-left">
      <div class="label">Income</div>
      <div class="value"><span>£</span>${Number(active.income).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
    </div>
    <button class="btn-ghost" onclick="openPeriodModal(null,'income')">Edit</button>
  </div>`;

  // Bills section
  html += `<div class="section-label">Bills This Period</div><div class="card">`;
  html += `<div class="bills-subheading" style="border-top:none;padding-top:0">Regular Bills</div>`;

  const grouped = {};
  calculatedBills.forEach(b => { if (!grouped[b.space]) grouped[b.space] = []; grouped[b.space].push(b); });

  const excludedBills = [];
  (appData.regularPayments || []).forEach(p => {
    if (overrides[p.id] && overrides[p.id].excluded) excludedBills.push(p);
  });

  let hasBills = false;
  spaceOrder.forEach(space => {
    if (!grouped[space] || grouped[space].length === 0) return;
    hasBills = true;
    grouped[space].forEach(b => {
      html += `<div class="bill-row">
        <div class="space-pip" style="background:${spaceColor(b.space)}"></div>
        <div class="bill-info">
          <div class="bill-name">${b.name}</div>
          <div class="bill-meta">${b.bank} · ${b.pay_from}</div>
        </div>
        <div class="bill-amounts">
          <div class="amt">${fmt(b.amount)}</div>
          ${b.variation > 0 ? `<div class="var">±${fmt(b.variation)}</div>` : ''}
        </div>
        <button class="bill-edit-btn" onclick='openBudgetBillModal(${JSON.stringify(b)})'>Edit</button>
      </div>`;
    });
  });

  excludedBills.forEach(p => {
    hasBills = true;
    html += `<div class="bill-row" style="opacity:0.45">
      <div class="space-pip" style="background:${spaceColor(p.space)}"></div>
      <div class="bill-info">
        <div class="bill-name" style="text-decoration:line-through">${p.name}</div>
        <div class="bill-meta">Removed from this period</div>
      </div>
      <div class="bill-amounts"><div class="amt" style="text-decoration:line-through">${fmt(p.amount)}</div></div>
      <button class="bill-edit-btn" onclick="restoreBillToPeriod(${p.id})">Restore</button>
    </div>`;
  });

  if (!hasBills) html += `<div style="padding:10px 0 4px;color:var(--muted);font-size:14px">No regular bills for this period</div>`;

  // One-offs
  html += `<div class="bills-subheading">One-Off Payments</div>`;
  if (oneoffs.length > 0) {
    oneoffs.forEach((b, idx) => {
      html += `<div class="bill-row">
        <div class="space-pip" style="background:var(--accent)"></div>
        <div class="bill-info">
          <div class="bill-name">${b.name}</div>
          <div class="bill-meta">${b.account||''} · ${b.pay_from||''}</div>
        </div>
        <div class="bill-amounts">
          <div class="amt">${fmt(b.amount)}</div>
          ${b.variation > 0 ? `<div class="var">±${fmt(b.variation)}</div>` : ''}
        </div>
        <button class="bill-edit-btn" onclick='openOneOffModal(${idx})'>Edit</button>
      </div>`;
    });
  }
  html += `<button onclick="openOneOffModal()" style="width:100%;margin-top:10px;background:var(--surface2);border:1px dashed var(--border);color:var(--text2);border-radius:var(--radius-sm);padding:14px;font-family:var(--font);font-size:15px;font-weight:600;cursor:pointer;">+ Add One-Off Payment</button>`;
  html += '</div>';

  // Accounts
  html += `<div class="section-label">Accounts</div>`;
  Object.entries(summary.accountTotals).forEach(([bank, totals]) => {
    const logo = bankLogos[bank] || `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M3 11h18"/><path d="M7 3h10l2 4H5l2-4z"/></svg>`;
    html += `<div class="acc-card ${accountColor(bank)}">
      <div class="acc-left">
        <div class="acc-logo">${logo}</div>
        <div><div class="acc-name">${bank}</div></div>
      </div>
      <div class="acc-right">
        <div class="acc-main">${fmt(totals.amount)}</div>
        <div class="acc-var">with var: ${fmt(totals.withVar)}</div>
      </div>
    </div>`;
  });

  // Pots
  html += `<div class="section-label">Pots & Spaces</div><div class="card">`;
  spaceOrder.forEach(space => {
    const pot = summary.pots[space];
    if (!pot || pot.amount === 0) return;
    html += `<div class="pot-row">
      <div class="pot-bar" style="background:${spaceColor(space)}"></div>
      <div class="pot-info"><div class="pot-name">${space}</div><div class="pot-bank">${pot.bank}</div></div>
      <div class="pot-amounts"><div class="pot-main">${fmt(pot.amount)}</div><div class="pot-var">+var: ${fmt(pot.withVar)}</div></div>
    </div>`;
  });
  html += '</div>';

  // Totals
  const loClass    = summary.leftOver < 0 ? 'neg' : 'pos';
  const loVarClass = summary.leftOverWithVar < 0 ? 'neg' : 'pos';
  const mt         = getMonthType(summary.leftOver);
  const mtVar      = getMonthType(summary.leftOverWithVar);
  html += `<div class="section-label">Totals</div><div class="card">
    <div class="totals-grid">
      <div class="total-cell"><div class="tc-label">Pot Totals</div><div class="tc-val">${fmt(summary.potTotal)}</div></div>
      <div class="total-cell"><div class="tc-label">With Variation</div><div class="tc-val">${fmt(summary.potTotalWithVar)}</div></div>
      <div class="total-cell"><div class="tc-label">Left Over</div><div class="tc-val ${loClass}">${fmtSigned(summary.leftOver)}</div></div>
      <div class="total-cell"><div class="tc-label">With Variation</div><div class="tc-val ${loVarClass}">${fmtSigned(summary.leftOverWithVar)}</div></div>
    </div>
    <div class="month-type-row">
      <div class="mt-badge ${mt}">${mt}</div>
      <div class="mt-badge ${mtVar}">${mtVar} (w/ var)</div>
    </div>
  </div>`;

  el.innerHTML = html;
}
