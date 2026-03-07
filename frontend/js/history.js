// ============================================================
// HISTORY PAGE
// ============================================================

async function loadHistory() {
  document.getElementById('history-content').innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
  const data = await api('GET', '/api/history');
  if (!data) return;
  historyData = data;
  renderHistory();
}

function renderHistory() {
  const el = document.getElementById('history-content');
  if (!historyData || historyData.length === 0) {
    el.innerHTML = '<div class="empty">No budgets saved yet.<br>Tap "Save & Create New" from the Budget tab.</div>';
    return;
  }

  const spaceOrder = ['Bills','Groceries','Subscriptions','Savings','Adhoc','Misc'];
  let html = '';

  historyData.forEach((budget, idx) => {
    const bills       = budget.bills_json  || [];
    const oneoffs     = budget.oneoff_json || [];
    const allBills    = [...bills, ...oneoffs];
    const total       = allBills.reduce((s, b) => s + (Number(b.amount)||0), 0);
    const totalWithVar= allBills.reduce((s, b) => s + (Number(b.amount)||0) + (Number(b.variation)||0), 0);
    const leftOver    = (Number(budget.income)||0) - total;
    const leftOverWithVar = (Number(budget.income)||0) - totalWithVar;
    const mt          = getMonthType(leftOver);
    const mtVar       = getMonthType(leftOverWithVar);
    const loClass     = leftOver < 0 ? 'neg' : 'pos';
    const loVarClass  = leftOverWithVar < 0 ? 'neg' : 'pos';

    const pots = {};
    allBills.forEach(b => { const s = b.space||'Misc'; if (!pots[s]) pots[s]=0; pots[s]+=Number(b.amount)||0; });

    const displayTitle = budget.name || `${fmtDate(budget.period_start)} → ${fmtDate(budget.period_end)}`;

    html += `<div class="history-item">
      <div class="history-header" onclick="toggleHistory(${idx})">
        <div style="flex:1;min-width:0">
          <div class="history-dates">${displayTitle}</div>
          <div class="history-meta">${budget.name ? `${fmtDate(budget.period_start)} → ${fmtDate(budget.period_end)} · ` : ''}Saved ${budget.snapshot_date} · ${fmt(budget.income)}</div>
          ${budget.note ? `<div style="font-size:12px;color:var(--text2);margin-top:4px;font-style:italic">"${budget.note}"</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0" onclick="event.stopPropagation()">
          <button class="history-action-btn edit"
            data-id="${budget.id}"
            data-name="${(budget.name||'').replace(/"/g,'&quot;')}"
            data-note="${(budget.note||'').replace(/"/g,'&quot;')}"
            onclick="openEditHistoryModal(this)" title="Edit">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="history-action-btn delete" onclick="deleteHistory(${budget.id})" title="Delete">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
          <span class="history-chevron" id="hc-${idx}" style="margin-left:4px">▼</span>
        </div>
      </div>
      <div class="history-body" id="hb-${idx}">
        <div class="history-summary">
          <div class="hs-cell"><div class="hs-label">Pot Totals</div><div class="hs-val">${fmt(total)}</div></div>
          <div class="hs-cell"><div class="hs-label">With Variation</div><div class="hs-val">${fmt(totalWithVar)}</div></div>
          <div class="hs-cell"><div class="hs-label">Left Over</div><div class="hs-val ${loClass}">${fmtSigned(leftOver)}</div></div>
          <div class="hs-cell"><div class="hs-label">With Variation</div><div class="hs-val ${loVarClass}">${fmtSigned(leftOverWithVar)}</div></div>
        </div>
        <div class="history-summary" style="border-bottom:none;padding-bottom:0">
          <div class="hs-cell" style="grid-column:span 2;display:flex;gap:8px;background:none;padding:8px 0 0">
            <div class="mt-badge ${mt}" style="flex:1">${mt}</div>
            <div class="mt-badge ${mtVar}" style="flex:1">${mtVar} (w/ var)</div>
          </div>
        </div>
        <div class="history-bills">
          <div style="padding:12px 0 8px">
            <span class="section-label" style="margin:0">Bills Breakdown</span>
          </div>`;

    spaceOrder.forEach(space => {
      if (!pots[space]) return;
      html += `<div class="pot-row" style="padding:8px 0">
        <div class="pot-bar" style="background:${spaceColor(space)}"></div>
        <div class="pot-info"><div class="pot-name">${space}</div></div>
        <div class="pot-amounts"><div class="pot-main">${fmt(pots[space])}</div></div>
      </div>`;
    });

    html += `<div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px">`;
    allBills.forEach(b => {
      html += `<div class="bill-row">
        <div class="space-pip" style="background:${spaceColor(b.space)}"></div>
        <div class="bill-info">
          <div class="bill-name">${b.name}${b.is_one_off ? ' <span class="badge oneoff">one-off</span>' : ''}</div>
          <div class="bill-meta">${b.bank||''} · ${b.pay_from||''}</div>
        </div>
        <div class="bill-amounts"><div class="amt">${fmt(b.amount)}</div></div>
      </div>`;
    });

    html += `</div></div></div></div>`;
  });

  el.innerHTML = html;
}

function toggleHistory(idx) {
  const body    = document.getElementById('hb-' + idx);
  const chevron = document.getElementById('hc-' + idx);
  const isOpen  = body.classList.toggle('open');
  chevron.classList.toggle('open', isOpen);
}

async function deleteHistory(id) {
  showConfirm('Delete Budget?', 'This will permanently remove this saved budget.', async () => {
    await api('DELETE', '/api/history/' + id);
    loadHistory();
    showToast('Budget deleted', 'success');
  });
}

function openEditHistoryModal(btn) {
  document.getElementById('edit-history-id').value   = btn.dataset.id;
  document.getElementById('edit-history-name').value = btn.dataset.name || '';
  document.getElementById('edit-history-note').value = btn.dataset.note || '';
  openModal('modal-edit-history');
}

async function saveHistoryMeta() {
  const id   = document.getElementById('edit-history-id').value;
  const name = document.getElementById('edit-history-name').value.trim();
  const note = document.getElementById('edit-history-note').value.trim();
  closeModal('modal-edit-history');
  showToast('Saving...', '');
  const r = await api('PUT', '/api/history', { id, name, note });
  if (r && r.success) { loadHistory(); showToast('Updated!', 'success'); }
}
