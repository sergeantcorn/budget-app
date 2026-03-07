// ============================================================
// BILLS PAGE
// ============================================================

function setBillsTab(filter) {
  billsFilter = filter;
  document.querySelectorAll('.pill-tab').forEach((t, i) => {
    t.classList.toggle('active', ['all','monthly','weekly','other'][i] === filter);
  });
  renderBills();
}

function renderBills() {
  if (!appData) return;
  const el = document.getElementById('bills-content');
  let payments = appData.regularPayments || [];

  if (billsFilter === 'monthly') payments = payments.filter(p => p.schedule === 'Monthly');
  else if (billsFilter === 'weekly') payments = payments.filter(p => p.schedule === 'Weekly');
  else if (billsFilter === 'other')  payments = payments.filter(p => !['Monthly','Weekly'].includes(p.schedule));

  if (payments.length === 0) { el.innerHTML = '<div class="empty">No bills found.</div>'; return; }

  const active   = payments.filter(p => p.status === 'Active');
  const inactive = payments.filter(p => p.status !== 'Active');

  let html = '';
  if (active.length > 0) {
    html += '<div class="section-label">Active</div><div class="card">';
    active.forEach(p => { html += billManageRow(p); });
    html += '</div>';
  }
  if (inactive.length > 0) {
    html += '<div class="section-label">Inactive / Cancelled</div><div class="card">';
    inactive.forEach(p => { html += billManageRow(p); });
    html += '</div>';
  }
  el.innerHTML = html;
}

function billManageRow(p) {
  return `<div class="manage-row">
    <div class="space-pip" style="background:${spaceColor(p.space)}"></div>
    <div class="manage-info">
      <div class="manage-name">${p.name}</div>
      <div class="manage-meta">${p.schedule} · ${p.date||'–'} · <span class="badge ${p.status}">${p.status}</span></div>
    </div>
    <div class="manage-right">
      <div class="manage-amount">${fmt(p.amount)}</div>
      ${p.variation > 0 ? `<div class="manage-amount-var">±${fmt(p.variation)}</div>` : ''}
    </div>
    <button class="bill-edit-btn" onclick='openBillModal(${JSON.stringify(p).replace(/'/g,"&#39;")})'>Edit</button>
  </div>`;
}
