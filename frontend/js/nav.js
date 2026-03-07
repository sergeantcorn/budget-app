// ============================================================
// NAV — page switching + data loading
// ============================================================

async function loadAllData() {
  const el = document.getElementById('budget-content');
  if (el) el.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';

  const data = await api('GET', '/api/data');
  if (!data) return;

  appData = data;
  renderBudget();
  if (currentPage === 'bills')    renderBills();
  if (currentPage === 'history')  loadHistory();
}

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => { p.classList.remove('active'); p.style.display = ''; });
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  pageEl.classList.add('active');
  pageEl.style.display = 'block';

  const navBtn = document.getElementById('nav-' + page);
  if (navBtn) navBtn.classList.add('active');

  currentPage = page;

  if (page === 'budget')     renderBudget();
  if (page === 'bills')      renderBills();
  if (page === 'history')    loadHistory();
  if (page === 'partitions') renderPartitions();
  if (page === 'accounts')   renderAccounts();
  if (page === 'cards')      renderCards();

  window.scrollTo(0, 0);
}

function showSubPage(name) { showPage(name); }
