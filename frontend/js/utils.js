// ============================================================
// UTILS — formatting, colours, calculation engine
// ============================================================

function fmt(n) {
  return '£' + Math.abs(Number(n) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtSigned(n) {
  const num = Number(n) || 0;
  return (num < 0 ? '-£' : '£') + Math.abs(num).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateInput(d) {
  return d ? d.substring(0, 10) : '';
}

function fmtDateShort(d) {
  if (!d) return '';
  const date = new Date(d + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${date.getDate()} ${months[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
}

function spaceColor(space) {
  return {
    'Bills':         'var(--c-bills)',
    'Groceries':     'var(--c-groceries)',
    'Secondary Bills': 'var(--c-secondary-bills)',
    'Savings':       'var(--c-savings)',
    'Adhoc':         'var(--c-adhoc)',
    'Misc':          'var(--c-misc)'
  }[space] || 'var(--muted)';
}

function accountColor(bank) {
  const b = (bank || '').toLowerCase();
  if (b === 'starling') return 'starling';
  if (b === 'monzo')    return 'monzo';
  return 'default';
}

// ── Budget calculation engine ────────────────────────────────

function calcBills(payments, startDate, endDate, overrides) {
  const start = new Date(startDate);
  const end   = new Date(endDate);
  const results = [];

  payments.forEach(p => {
    if (['Cancelled','Inactive','Deactivated'].includes(p.status)) return;
    if (!p.amount || Number(p.amount) === 0) return;

    const override = (overrides && overrides[p.id]) ? overrides[p.id] : {};
    if (override.excluded) return;

    const amount    = override.amount !== undefined ? override.amount : Number(p.amount);
    const variation = Number(p.variation) || 0;
    const date      = p.date || 'N/A';
    const sched     = p.schedule;

    let calcAmount = amount;
    let include    = false;

    if (sched === 'Daily') {
      const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
      calcAmount = amount * days;
      include = true;
    } else if (sched === 'Weekly') {
      const dayName = date === 'N/A' ? 'Monday' : date;
      const count = countWeekdayOccurrences(start, end, dayName);
      calcAmount = amount * count;
      include = count > 0;
    } else if (sched === 'Monthly') {
      if (date === 'N/A' || date === 'All') {
        include = true; calcAmount = amount;
      } else {
        const dayNum = extractDayNum(date);
        if (dayNum) {
          const { count, included } = countMonthlyOccurrences(start, end, dayNum);
          include = included; calcAmount = amount * count;
        }
      }
    } else if (sched === 'Yearly') {
      if (date === 'N/A' || date === 'All') {
        include = true; calcAmount = amount;
      } else {
        const { count, included } = countYearlyOccurrences(start, end, date);
        include = included; calcAmount = amount * count;
      }
    }

    if (!include) return;

    let payFrom = p.linked_card || '';
    if (payFrom === 'None') payFrom = 'Main';
    if (payFrom === 'N/A')  payFrom = 'None';

    results.push({
      payment_id: p.id,
      name:       override.name || p.name,
      bank:       p.account || '',
      space:      override.space || p.space || '',
      amount:     calcAmount,
      variation,
      type:       p.type || '',
      pay_from:   payFrom,
      is_one_off: false
    });
  });

  return results;
}

function countWeekdayOccurrences(start, end, dayName) {
  const days = { Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6, Sunday:0 };
  const target = days[dayName] !== undefined ? days[dayName] : 1;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) { if (cur.getDay() === target) count++; cur.setDate(cur.getDate() + 1); }
  return count;
}

function countMonthlyOccurrences(start, end, dayNum) {
  let count = 0; let included = false;
  const cur = new Date(start.getFullYear(), start.getMonth(), dayNum);
  if (cur < start) cur.setMonth(cur.getMonth() + 1);
  while (cur <= end) { count++; included = true; cur.setMonth(cur.getMonth() + 1); }
  return { count: Math.max(count, included ? 1 : 0), included };
}

function countYearlyOccurrences(start, end, dateStr) {
  const dayNum    = extractDayNum(dateStr);
  const monthName = extractMonthName(dateStr);
  if (!dayNum || !monthName) return { count: 0, included: false };
  const monthMap = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11,
    January:0, February:1, March:2, April:3, June:5, July:6, August:7, September:8, October:9, November:10, December:11 };
  const month = monthMap[monthName];
  if (month === undefined) return { count: 0, included: false };
  let count = 0; let included = false; let year = start.getFullYear();
  while (true) {
    const d = new Date(year, month, dayNum);
    if (d > end) break;
    if (d >= start) { count++; included = true; }
    year++;
    if (year > end.getFullYear() + 1) break;
  }
  return { count: Math.max(count, 0), included };
}

function extractDayNum(str)   { if (!str) return null; const m = str.match(/(\d+)/);     return m ? parseInt(m[1]) : null; }
function extractMonthName(str){ if (!str) return null; const m = str.match(/([A-Za-z]+)/); return m ? m[1] : null; }

function calcSummary(bills, oneoffs, income) {
  const allBills   = [...bills, ...oneoffs];
  const partitions = appData ? appData.accountPartitions : [];
  const accounts   = appData ? appData.accounts : [];
  const spaceOrder = ['Bills','Groceries','Subscriptions','Savings','Adhoc','Misc'];

  const pots = {};
  spaceOrder.forEach(s => { pots[s] = { amount: 0, withVar: 0, bank: '' }; });

  allBills.forEach(b => {
    const space = b.space || 'Misc';
    if (!pots[space]) pots[space] = { amount: 0, withVar: 0, bank: '' };
    pots[space].amount  += Number(b.amount) || 0;
    pots[space].withVar += (Number(b.amount) || 0) + (Number(b.variation) || 0);
    if (!pots[space].bank) pots[space].bank = b.bank || '';
  });

  partitions.forEach(p => { if (pots[p.partition_name]) pots[p.partition_name].bank = p.bank; });

  const accountTotals = {};
  accounts.forEach(a => { accountTotals[a.bank] = { amount: 0, withVar: 0 }; });
  allBills.forEach(b => {
    const bank = b.bank || '';
    if (bank && accountTotals[bank] !== undefined) {
      accountTotals[bank].amount  += Number(b.amount) || 0;
      accountTotals[bank].withVar += (Number(b.amount) || 0) + (Number(b.variation) || 0);
    }
  });

  const potTotal        = Object.values(pots).reduce((s, p) => s + p.amount,  0);
  const potTotalWithVar = Object.values(pots).reduce((s, p) => s + p.withVar, 0);

  return { pots, accountTotals, potTotal, potTotalWithVar, leftOver: income - potTotal, leftOverWithVar: income - potTotalWithVar };
}

function getMonthType(leftOver) {
  if (leftOver < 0)   return 'NEGATIVE';
  if (leftOver < 200) return 'LOW';
  if (leftOver <= 400) return 'AVERAGE';
  return 'HIGH';
}

// ── Shared helpers ───────────────────────────────────────────

function populateSelect(id, options, selected) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.value; o.textContent = opt.label;
    if (String(opt.value) === String(selected)) o.selected = true;
    el.appendChild(o);
  });
}

function openModal(id)  { document.getElementById(id).classList.add('open');    }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + (type || '');
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2500);
}

function showConfirm(title, msg, onOk) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent   = msg;
  pendingConfirm = onOk;
  document.getElementById('confirm-dialog').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirm-dialog').classList.remove('open');
  pendingConfirm = null;
}
