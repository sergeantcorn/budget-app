// ============================================================
// SETTINGS SUB-PAGES
// ============================================================

// ── Partitions ───────────────────────────────────────────────

function renderPartitions() {
  if (!appData) return;
  const el         = document.getElementById('partitions-content');
  const partitions = appData.accountPartitions || [];
  if (partitions.length === 0) { el.innerHTML = '<div class="empty">No spaces yet. Tap + to add.</div>'; return; }

  let html = '<div class="card">';
  partitions.forEach(p => {
    html += `<div class="manage-row">
      <div class="space-pip" style="background:${spaceColor(p.partition_name)}"></div>
      <div class="manage-info">
        <div class="manage-name">${p.partition_name}</div>
        <div class="manage-meta">${p.bank} · ${p.status}</div>
      </div>
      <button class="bill-edit-btn" onclick='openPartitionModal(${JSON.stringify(p).replace(/'/g,"&#39;")})'>Edit</button>
    </div>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

function openPartitionModal(partition) {
  if (typeof partition === 'string') partition = JSON.parse(partition);
  const isEdit = !!partition;
  document.getElementById('modal-partition-title').textContent = isEdit ? 'Edit Space' : 'Add Space';
  document.getElementById('partition-id').value     = isEdit ? partition.id : '';
  document.getElementById('partition-name').value   = isEdit ? partition.partition_name : '';
  document.getElementById('partition-status').value = isEdit ? partition.status : 'Active';
  populateSelect('partition-bank', (appData.accounts||[]).map(a=>({value:a.bank,label:a.bank})), isEdit ? partition.bank : '');
  populateSelect('partition-card', (appData.cards||[]).map(c=>({value:c.id,label:c.card_name})), isEdit ? partition.cards_id : '');
  document.getElementById('btn-delete-partition').style.display = isEdit ? 'block' : 'none';
  openModal('modal-partition');
}

async function savePartition() {
  const partition = {
    id:             document.getElementById('partition-id').value || null,
    partition_name: document.getElementById('partition-name').value,
    bank:           document.getElementById('partition-bank').value,
    cards_id:       document.getElementById('partition-card').value,
    status:         document.getElementById('partition-status').value
  };
  closeModal('modal-partition');
  await api('POST', '/api/partitions', partition);
  loadAllData();
  showToast('Space saved!', 'success');
}

async function deletePartition() {
  const id = document.getElementById('partition-id').value;
  showConfirm('Delete Space?', 'This will remove this space/pot.', async () => {
    closeModal('modal-partition');
    await api('DELETE', '/api/partitions/' + id);
    loadAllData();
    showToast('Space deleted', 'success');
  });
}

// ── Accounts ─────────────────────────────────────────────────

function renderAccounts() {
  if (!appData) return;
  const el       = document.getElementById('accounts-content');
  const accounts = appData.accounts || [];
  if (accounts.length === 0) { el.innerHTML = '<div class="empty">No accounts yet. Tap + to add.</div>'; return; }

  let html = '<div class="card">';
  accounts.forEach(a => {
    const logo = bankLogos[a.bank] || `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M3 11h18M7 3h10l2 4H5l2-4z"/></svg>`;
    const logoStyle = a.bank === 'Starling' ? 'background:#6935d3;padding:5px;'
                    : a.bank === 'Monzo'    ? 'background:transparent;padding:3px;'
                    : 'background:rgba(255,255,255,0.08);padding:5px;';
    html += `<div class="manage-row">
      <div style="width:46px;height:46px;border-radius:13px;flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;${logoStyle}">${logo}</div>
      <div class="manage-info" style="flex:1;margin-left:14px">
        <div class="manage-name" style="font-size:17px;font-weight:700">${a.bank}</div>
      </div>
      <button class="bill-edit-btn" onclick='openAccountModal(${JSON.stringify(a).replace(/'/g,"&#39;")})'>Edit</button>
    </div>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

function openAccountModal(account) {
  if (typeof account === 'string') account = JSON.parse(account);
  const isEdit = !!account;
  document.getElementById('modal-account-title').textContent = isEdit ? 'Edit Account' : 'Add Account';
  document.getElementById('account-id').value   = isEdit ? account.id : '';
  document.getElementById('account-bank').value = isEdit ? account.bank : '';
  document.getElementById('btn-delete-account').style.display = isEdit ? 'block' : 'none';
  openModal('modal-account');
}

async function saveAccountItem() {
  const account = {
    id:   document.getElementById('account-id').value || null,
    bank: document.getElementById('account-bank').value
  };
  closeModal('modal-account');
  await api('POST', '/api/accounts', account);
  loadAllData();
  showToast('Account saved!', 'success');
}

async function deleteAccountItem() {
  const id = document.getElementById('account-id').value;
  showConfirm('Delete Account?', 'This will remove this bank account.', async () => {
    closeModal('modal-account');
    await api('DELETE', '/api/accounts/' + id);
    loadAllData();
    showToast('Account deleted', 'success');
  });
}

// ── Cards ─────────────────────────────────────────────────────

function renderCards() {
  if (!appData) return;
  const el    = document.getElementById('cards-content');
  const cards = appData.cards || [];
  if (cards.length === 0) { el.innerHTML = '<div class="empty">No cards yet. Tap + to add.</div>'; return; }

  let html = '<div class="card">';
  cards.forEach(c => {
    const account = (appData.accounts||[]).find(a => a.id == c.account_id);
    html += `<div class="manage-row">
      <div class="manage-info">
        <div class="manage-name">${c.card_name}</div>
        <div class="manage-meta">${account ? account.bank : ''}</div>
      </div>
      <button class="bill-edit-btn" onclick='openCardModal(${JSON.stringify(c).replace(/'/g,"&#39;")})'>Edit</button>
    </div>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

function openCardModal(card) {
  if (typeof card === 'string') card = JSON.parse(card);
  const isEdit = !!card;
  document.getElementById('modal-card-title').textContent = isEdit ? 'Edit Card' : 'Add Card';
  document.getElementById('card-id').value   = isEdit ? card.id : '';
  document.getElementById('card-name').value = isEdit ? card.card_name : '';
  populateSelect('card-account',    (appData.accounts||[]).map(a=>({value:a.id,label:a.bank})), isEdit ? card.account_id : '');
  populateSelect('card-partition',  (appData.accountPartitions||[]).map(p=>({value:p.id,label:p.partition_name})), isEdit ? card.account_partition_id : '');
  document.getElementById('btn-delete-card').style.display = isEdit ? 'block' : 'none';
  openModal('modal-card');
}

async function saveCardItem() {
  const card = {
    id:                   document.getElementById('card-id').value || null,
    card_name:            document.getElementById('card-name').value,
    account_id:           document.getElementById('card-account').value,
    account_partition_id: document.getElementById('card-partition').value
  };
  closeModal('modal-card');
  await api('POST', '/api/cards', card);
  loadAllData();
  showToast('Card saved!', 'success');
}

async function deleteCardItem() {
  const id = document.getElementById('card-id').value;
  showConfirm('Delete Card?', 'This will remove this card.', async () => {
    closeModal('modal-card');
    await api('DELETE', '/api/cards/' + id);
    loadAllData();
    showToast('Card deleted', 'success');
  });
}
