// ============================================================
// MODALS — Budget (period, income, save, new budget, history edit)
// ============================================================

// ── Shared save helper ────────────────────────────────────────

async function saveActiveBudgetState(callback) {
  const active = appData.activeBudget;
  const r = await api('POST', '/api/budget', active);
  if (r && r.success) { if (callback) callback(); showToast('Saved!', 'success'); }
  else showToast('Save failed', 'error');
}

// ── Period / income modal ─────────────────────────────────────

function openPeriodModal(active) {
  if (active && typeof active === 'string') {
    try { active = JSON.parse(active.replace(/&quot;/g, '"')); } catch(e) {}
  }
  const a = active || appData.activeBudget;
  document.getElementById('date-start').value  = a ? fmtDateInput(a.period_start) : '';
  document.getElementById('date-end').value    = a ? fmtDateInput(a.period_end) : '';
  document.getElementById('date-income').value = a ? a.income : (appData.defaults.find(d=>d.name==='Income')||{default_value:0}).default_value;
  openModal('modal-dates');
}

async function savePeriod() {
  const start  = document.getElementById('date-start').value;
  const end    = document.getElementById('date-end').value;
  const income = parseFloat(document.getElementById('date-income').value) || 0;
  if (!start || !end) { showToast('Please fill in both dates', 'error'); return; }
  closeModal('modal-dates');

  const active = appData.activeBudget || {};
  const budget = {
    period_start:   start,
    period_end:     end,
    income,
    bills_json:     active.bills_json     || [],
    oneoff_json:    active.oneoff_json    || [],
    overrides_json: active.overrides_json || {}
  };

  const r = await api('POST', '/api/budget', budget);
  if (r && r.success) {
    if (appData.activeBudget) {
      appData.activeBudget.period_start = start;
      appData.activeBudget.period_end   = end;
      appData.activeBudget.income       = income;
    } else {
      appData.activeBudget = budget;
    }
    renderBudget();
    showToast('Period saved!', 'success');
  }
}

// ── Save & Create New ─────────────────────────────────────────

function openSaveModal() {
  const active = appData.activeBudget;
  if (!active) { showToast('No active budget to save', 'error'); return; }
  const start = active.period_start ? fmtDateShort(active.period_start) : '';
  const end   = active.period_end   ? fmtDateShort(active.period_end)   : '';
  document.getElementById('save-name').value = (start && end) ? `${start} – ${end}` : '';
  document.getElementById('save-note').value = '';
  openModal('modal-save');
}

async function saveAndProceedToNew() {
  const active = appData.activeBudget;
  if (!active) return;

  const name = document.getElementById('save-name').value.trim();
  const note = document.getElementById('save-note').value.trim();
  showToast('Saving budget...', '');
  closeModal('modal-save');

  const overrides        = active.overrides_json || {};
  const calculatedBills  = calcBills(appData.regularPayments, active.period_start, active.period_end, overrides);
  const snapshotBudget   = { ...active, bills_json: calculatedBills, name, note };

  const r = await api('POST', '/api/history', snapshotBudget);
  if (r && r.success) {
    historyData = null;
    showToast('Budget saved!', 'success');
    openNewBudgetSetup();
  } else {
    showToast('Error saving budget', 'error');
  }
}

// ── New Budget setup ──────────────────────────────────────────

function openNewBudgetSetup() {
  const today  = new Date();
  const plus30 = new Date(today);
  plus30.setDate(today.getDate() + 30);
  const fmt2 = d => d.toISOString().slice(0, 10);
  document.getElementById('new-start').value  = fmt2(today);
  document.getElementById('new-end').value    = fmt2(plus30);
  document.getElementById('new-income').value = '3550';
  openModal('modal-new-budget');
}

async function confirmNewBudget() {
  const start  = document.getElementById('new-start').value;
  const end    = document.getElementById('new-end').value;
  const income = parseFloat(document.getElementById('new-income').value) || 3550;
  if (!start || !end) { showToast('Please set both dates', 'error'); return; }

  closeModal('modal-new-budget');
  showToast('Starting new budget...', '');

  const freshBills  = calcBills(appData.regularPayments || [], start, end, {});
  const freshBudget = { period_start: start, period_end: end, income, bills_json: freshBills, oneoff_json: [], overrides_json: {} };

  const r = await api('POST', '/api/budget', freshBudget);
  if (r && r.success) {
    appData.activeBudget = freshBudget;
    renderBudget();
    showToast('New budget ready!', 'success');
  }
}
