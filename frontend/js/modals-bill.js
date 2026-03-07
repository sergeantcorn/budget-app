// ============================================================
// MODALS — Bill (shared by Budget page + Bills page)
// ============================================================

// ── Regular bill modal (add/edit/delete) ─────────────────────

function openBillModal(payment) {
  if (typeof payment === 'string') payment = JSON.parse(payment);
  const isEdit = !!payment;
  document.getElementById('modal-bill-title').textContent   = isEdit ? 'Edit Bill' : 'Add Bill';
  document.getElementById('bill-id').value                  = isEdit ? payment.id : '';
  document.getElementById('bill-name').value                = isEdit ? payment.name : '';
  document.getElementById('bill-schedule').value            = isEdit ? payment.schedule : 'Monthly';
  document.getElementById('bill-date').value                = isEdit ? (payment.date || '') : '';
  document.getElementById('bill-status').value              = isEdit ? payment.status : 'Active';
  document.getElementById('bill-amount').value              = isEdit ? payment.amount : '';
  document.getElementById('bill-variation').value           = isEdit ? payment.variation : 0;
  document.getElementById('bill-type').value                = isEdit ? payment.type : 'Auto';
  document.getElementById('bill-importance').value          = isEdit ? payment.importance : 'Mandatory';
  populateSelect('bill-partition', (appData.accountPartitions||[]).map(p=>({value:p.id,label:p.partition_name})), isEdit ? payment.account_partition_id : '');
  document.getElementById('btn-delete-bill').style.display  = isEdit ? 'block' : 'none';
  openModal('modal-bill');
}

async function saveRegPayment() {
  const payment = {
    id:                   document.getElementById('bill-id').value || null,
    name:                 document.getElementById('bill-name').value,
    schedule:             document.getElementById('bill-schedule').value,
    date:                 document.getElementById('bill-date').value,
    amount:               parseFloat(document.getElementById('bill-amount').value) || 0,
    variation:            parseFloat(document.getElementById('bill-variation').value) || 0,
    status:               document.getElementById('bill-status').value,
    type:                 document.getElementById('bill-type').value,
    importance:           document.getElementById('bill-importance').value,
    account_partition_id: document.getElementById('bill-partition').value
  };

  closeModal('modal-bill');
  showToast('Saving...', '');

  const r = await api('POST', '/api/payments', payment);
  if (!r || !r.success) { showToast('Save failed', 'error'); return; }

  const data = await api('GET', '/api/data');
  if (!data) return;
  appData = data;

  const active = appData.activeBudget;
  if (active && active.period_start && active.period_end && payment.status === 'Active') {
    const overrides  = active.overrides_json || {};
    const freshBills = calcBills(appData.regularPayments, active.period_start, active.period_end, overrides);
    const updatedBudget = { ...active, bills_json: freshBills };
    await api('POST', '/api/budget', updatedBudget);
    appData.activeBudget = updatedBudget;
    showToast('Bill saved & budget updated!', 'success');
  } else {
    showToast('Bill saved!', 'success');
  }

  renderBudget();
  if (currentPage === 'bills') renderBills();
}

async function deleteRegPayment() {
  const id = document.getElementById('bill-id').value;
  showConfirm('Delete Bill?', 'This will permanently remove this bill from Regular Bills.', async () => {
    closeModal('modal-bill');
    await api('DELETE', '/api/payments/' + id);
    loadAllData();
    showToast('Bill deleted', 'success');
  });
}

// ── Budget-period bill override modal ────────────────────────

function openBudgetBillModal(bill) {
  if (typeof bill === 'string') bill = JSON.parse(bill);
  document.getElementById('bb-modal-title').textContent = bill.name || 'Edit for This Period';
  document.getElementById('bb-payment-id').value        = bill.payment_id;
  document.getElementById('bb-amount').value            = bill.amount;
  document.getElementById('bb-variation').value         = bill.variation;

  const spaceEl = document.getElementById('bb-space');
  spaceEl.innerHTML = '';
  (appData.accountPartitions || []).map(p => p.partition_name).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    if (s === bill.space) opt.selected = true;
    spaceEl.appendChild(opt);
  });
  openModal('modal-budget-bill');
}

async function saveBudgetBillOverride() {
  const id        = document.getElementById('bb-payment-id').value;
  const amount    = parseFloat(document.getElementById('bb-amount').value) || 0;
  const variation = parseFloat(document.getElementById('bb-variation').value) || 0;
  const space     = document.getElementById('bb-space').value;

  const active = appData.activeBudget;
  if (!active.overrides_json) active.overrides_json = {};
  active.overrides_json[id] = { amount, variation, space };

  closeModal('modal-budget-bill');
  await saveActiveBudgetState(() => renderBudget());
}

async function removeBillFromBudget() {
  const id     = document.getElementById('bb-payment-id').value;
  const active = appData.activeBudget;
  if (!active.overrides_json) active.overrides_json = {};
  active.overrides_json[id] = { excluded: true };
  closeModal('modal-budget-bill');
  await saveActiveBudgetState(() => renderBudget());
}

async function restoreBillToPeriod(id) {
  const active = appData.activeBudget;
  if (!active.overrides_json) return;
  delete active.overrides_json[id];
  await saveActiveBudgetState(() => renderBudget());
  showToast('Bill restored to period', 'success');
}

// ── One-off modal ─────────────────────────────────────────────

function openOneOffModal(idx) {
  const deleteBtn = document.getElementById('btn-delete-oneoff');
  populateSelect('oneoff-account', (appData.accounts||[]).map(a=>({value:a.bank,label:a.bank})));
  populateSelect('oneoff-space',   (appData.accountPartitions||[]).map(p=>({value:p.partition_name,label:p.partition_name})));
  populateSelect('oneoff-card',    (appData.cards||[]).map(c=>({value:c.card_name,label:c.card_name})));

  if (idx !== undefined && idx !== null) {
    const oneoff = (appData.activeBudget.oneoff_json || [])[idx];
    document.getElementById('modal-oneoff-title').textContent = 'Edit One-Off';
    document.getElementById('oneoff-idx').value               = idx;
    document.getElementById('oneoff-name').value              = oneoff.name || '';
    document.getElementById('oneoff-amount').value            = oneoff.amount || '';
    document.getElementById('oneoff-variation').value         = oneoff.variation || 0;
    document.getElementById('oneoff-type').value              = oneoff.type || 'Manual';
    document.getElementById('oneoff-account').value           = oneoff.account || '';
    document.getElementById('oneoff-space').value             = oneoff.space || '';
    document.getElementById('oneoff-card').value              = oneoff.pay_from || '';
    deleteBtn.style.display = 'block';
  } else {
    document.getElementById('modal-oneoff-title').textContent = 'Add One-Off';
    document.getElementById('oneoff-idx').value               = '';
    document.getElementById('oneoff-name').value              = '';
    document.getElementById('oneoff-amount').value            = '';
    document.getElementById('oneoff-variation').value         = 0;
    document.getElementById('oneoff-type').value              = 'Manual';
    deleteBtn.style.display = 'none';
  }
  openModal('modal-oneoff');
}

async function saveOneOff() {
  const idx    = document.getElementById('oneoff-idx').value;
  const oneoff = {
    name:       document.getElementById('oneoff-name').value,
    amount:     parseFloat(document.getElementById('oneoff-amount').value) || 0,
    variation:  parseFloat(document.getElementById('oneoff-variation').value) || 0,
    type:       document.getElementById('oneoff-type').value,
    account:    document.getElementById('oneoff-account').value,
    bank:       document.getElementById('oneoff-account').value,
    space:      document.getElementById('oneoff-space').value,
    pay_from:   document.getElementById('oneoff-card').value,
    is_one_off: true
  };

  const active = appData.activeBudget;
  if (!active.oneoff_json) active.oneoff_json = [];
  if (idx !== '') active.oneoff_json[parseInt(idx)] = oneoff;
  else            active.oneoff_json.push(oneoff);

  closeModal('modal-oneoff');
  await saveActiveBudgetState(() => renderBudget());
}

async function deleteOneOff() {
  const idx = parseInt(document.getElementById('oneoff-idx').value);
  appData.activeBudget.oneoff_json.splice(idx, 1);
  closeModal('modal-oneoff');
  await saveActiveBudgetState(() => renderBudget());
}
