// ============================================================
// Budget App — Cloudflare Worker Backend
// Handles all API requests, auth, and D1 database access
// ============================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── HELPERS ─────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function err(msg, status = 400) {
  return json({ error: msg }, status);
}

// Safe value helpers (same logic as Code.gs)
const sv = v => (v === null || v === undefined) ? '' : String(v).trim();
const nv = (v, d = 0) => { const p = parseFloat(v); return isNaN(p) ? d : p; };
const iv = (v, d = 0) => { const p = parseInt(v, 10); return isNaN(p) ? d : p; };
const ev = (v, allowed, fallback) => allowed.includes(sv(v)) ? sv(v) : fallback;
const jv = (v, fallback) => { try { return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const dv = v => {
  if (!v) return '';
  try {
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  } catch { return ''; }
};

// ── JWT AUTH ─────────────────────────────────────────────────
// Simple JWT using Web Crypto API (built into Workers)

async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const enc = str => btoa(JSON.stringify(str)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const data = `${enc(header)}.${enc(payload)}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${sigB64}`;
}

async function verifyJWT(token, secret) {
  try {
    const [headerB64, payloadB64, sigB64] = token.split('.');
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sig = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(`${headerB64}.${payloadB64}`));
    if (!valid) return null;
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch { return null; }
}

// Simple bcrypt-equivalent using PBKDF2 (native to Workers)
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256
  );
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const salt = Uint8Array.from(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256
  );
  const candidateHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return candidateHex === hashHex;
}

async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return null;
  return await verifyJWT(token, env.JWT_SECRET);
}

// ── ROUTER ───────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

    // ── AUTH ROUTES (no token needed) ──
    if (path === '/api/login' && method === 'POST') return handleLogin(request, env);
    if (path === '/api/setup' && method === 'POST') return handleSetup(request, env);

    // ── ALL OTHER ROUTES REQUIRE AUTH ──
    const user = await requireAuth(request, env);
    if (!user) return err('Unauthorised', 401);

    // Data
    if (path === '/api/data'         && method === 'GET')    return handleGetAllData(env);
    if (path === '/api/history'      && method === 'GET')    return handleGetHistory(env);

    // Active budget
    if (path === '/api/budget'       && method === 'POST')   return handleSaveBudget(request, env);

    // Budget history
    if (path === '/api/history'      && method === 'POST')   return handleSnapshotBudget(request, env);
    if (path === '/api/history'      && method === 'PUT')    return handleUpdateHistory(request, env);
    if (path.startsWith('/api/history/') && method === 'DELETE') return handleDeleteHistory(path, env);

    // Regular payments
    if (path === '/api/payments'     && method === 'POST')   return handleSavePayment(request, env);
    if (path.startsWith('/api/payments/') && method === 'DELETE') return handleDeletePayment(path, env);

    // Account partitions
    if (path === '/api/partitions'   && method === 'POST')   return handleSavePartition(request, env);
    if (path.startsWith('/api/partitions/') && method === 'DELETE') return handleDeletePartition(path, env);

    // Accounts
    if (path === '/api/accounts'     && method === 'POST')   return handleSaveAccount(request, env);
    if (path.startsWith('/api/accounts/') && method === 'DELETE') return handleDeleteAccount(path, env);

    // Cards
    if (path === '/api/cards'        && method === 'POST')   return handleSaveCard(request, env);
    if (path.startsWith('/api/cards/') && method === 'DELETE') return handleDeleteCard(path, env);

    return err('Not found', 404);
  }
};

// ── AUTH HANDLERS ─────────────────────────────────────────────

async function handleLogin(request, env) {
  const { username, password } = await request.json();
  if (!username || !password) return err('Missing credentials');

  const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(sv(username)).first();
  if (!user) return err('Invalid credentials', 401);

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return err('Invalid credentials', 401);

  const token = await signJWT(
    { sub: user.id, username: user.username, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 },
    env.JWT_SECRET
  );
  return json({ token, username: user.username });
}

// One-time setup route — creates the first user
// Disabled once a user exists
async function handleSetup(request, env) {
  const count = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first();
  if (count.c > 0) return err('Setup already complete', 403);

  const { username, password } = await request.json();
  if (!username || !password) return err('Missing username or password');
  if (password.length < 8) return err('Password must be at least 8 characters');

  const hash = await hashPassword(password);
  await env.DB.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').bind(sv(username), hash).run();
  return json({ success: true, message: 'User created. You can now log in.' });
}

// ── DATA HANDLERS ─────────────────────────────────────────────

async function handleGetAllData(env) {
  const [payments, partitions, accounts, cards, monthTypes, defaults, budget] = await Promise.all([
    env.DB.prepare('SELECT * FROM regular_payments ORDER BY id').all(),
    env.DB.prepare('SELECT * FROM account_partition ORDER BY id').all(),
    env.DB.prepare('SELECT * FROM account ORDER BY id').all(),
    env.DB.prepare('SELECT * FROM cards ORDER BY id').all(),
    env.DB.prepare('SELECT * FROM month_types ORDER BY id').all(),
    env.DB.prepare('SELECT * FROM defaults ORDER BY id').all(),
    env.DB.prepare('SELECT * FROM active_budget WHERE id = 1').first(),
  ]);

  // Build lookup maps
  const partitionMap = {};
  (partitions.results || []).forEach(p => { partitionMap[p.id] = p; });

  const cardByPartition = {};
  (cards.results || []).forEach(c => {
    if (c.account_partition_id) cardByPartition[c.account_partition_id] = c.card_name;
  });

  // Enrich payments
  const regularPayments = (payments.results || []).map(p => {
    const pid = iv(p.account_partition_id);
    const partition = partitionMap[pid] || {};
    return {
      id:                   iv(p.id),
      name:                 sv(p.name) || 'Unnamed',
      schedule:             ev(p.schedule, ['Monthly','Weekly','Daily','Yearly','Other'], 'Monthly'),
      date:                 sv(p.date),
      amount:               nv(p.amount),
      variation:            nv(p.variation),
      status:               ev(p.status, ['Active','Inactive','Cancelled'], 'Active'),
      type:                 ev(p.type, ['Auto','Manual'], 'Auto'),
      importance:           ev(p.importance, ['Mandatory','Needed','Optional'], 'Mandatory'),
      account_partition_id: pid,
      space:                sv(partition.partition_name) || 'Misc',
      account:              sv(partition.bank),
      linked_card:          sv(cardByPartition[pid]) || 'Main',
    };
  });

  const cleanPartitions = (partitions.results || []).map(p => ({
    id:             iv(p.id),
    partition_name: sv(p.partition_name) || 'Unnamed',
    bank:           sv(p.bank),
    cards_id:       iv(p.cards_id),
    status:         ev(p.status, ['Active','Inactive'], 'Active'),
  }));

  const cleanAccounts = (accounts.results || []).map(a => ({
    id:   iv(a.id),
    bank: sv(a.bank) || 'Unknown',
  }));

  const cleanCards = (cards.results || []).map(c => ({
    id:                   iv(c.id),
    card_name:            sv(c.card_name) || 'Card',
    account_id:           iv(c.account_id),
    account_partition_id: iv(c.account_partition_id),
  }));

  const cleanMonthTypes = (monthTypes.results || []).map(m => ({
    id:        iv(m.id),
    name:      sv(m.name),
    more_than: m.more_than !== null && m.more_than !== '' ? nv(m.more_than) : null,
    less_than: m.less_than !== null && m.less_than !== '' ? nv(m.less_than) : null,
  }));

  const cleanDefaults = (defaults.results || []).map(d => ({
    id:            iv(d.id),
    name:          sv(d.name),
    default_value: sv(d.default_value),
  }));

  let activeBudget = null;
  if (budget) {
    const hasStart  = !!budget.period_start;
    const hasEnd    = !!budget.period_end;
    const hasIncome = nv(budget.income) > 0;
    if (hasStart || hasEnd || hasIncome) {
      activeBudget = {
        period_start:   dv(budget.period_start),
        period_end:     dv(budget.period_end),
        income:         nv(budget.income),
        bills_json:     jv(budget.bills_json, []),
        oneoff_json:    jv(budget.oneoff_json, []),
        overrides_json: jv(budget.overrides_json, {}),
      };
    }
  }

  return json({ regularPayments, accountPartitions: cleanPartitions, accounts: cleanAccounts, cards: cleanCards, monthTypes: cleanMonthTypes, defaults: cleanDefaults, activeBudget });
}

async function handleGetHistory(env) {
  const { results } = await env.DB.prepare('SELECT * FROM budget_history ORDER BY snapshot_date DESC').all();
  const history = (results || []).map(row => ({
    id:            iv(row.id),
    name:          sv(row.name),
    note:          sv(row.note),
    snapshot_date: sv(row.snapshot_date),
    period_start:  dv(row.period_start),
    period_end:    dv(row.period_end),
    income:        nv(row.income),
    bills_json:    jv(row.bills_json, []),
    oneoff_json:   jv(row.oneoff_json, []),
  }));
  return json(history);
}

// ── BUDGET HANDLERS ───────────────────────────────────────────

async function handleSaveBudget(request, env) {
  const b = await request.json();
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO active_budget (id, period_start, period_end, income, bills_json, oneoff_json, overrides_json, modified_date)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      period_start   = excluded.period_start,
      period_end     = excluded.period_end,
      income         = excluded.income,
      bills_json     = excluded.bills_json,
      oneoff_json    = excluded.oneoff_json,
      overrides_json = excluded.overrides_json,
      modified_date  = excluded.modified_date
  `).bind(
    sv(b.period_start) || null,
    sv(b.period_end)   || null,
    nv(b.income),
    JSON.stringify(b.bills_json     || []),
    JSON.stringify(b.oneoff_json    || []),
    JSON.stringify(b.overrides_json || {}),
    now
  ).run();
  return json({ success: true });
}

async function handleSnapshotBudget(request, env) {
  const b = await request.json();
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO budget_history (name, note, snapshot_date, period_start, period_end, income, bills_json, oneoff_json, created_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    sv(b.name), sv(b.note), now,
    sv(b.period_start) || null,
    sv(b.period_end)   || null,
    nv(b.income),
    JSON.stringify(b.bills_json  || []),
    JSON.stringify(b.oneoff_json || []),
    now
  ).run();
  return json({ success: true });
}

async function handleUpdateHistory(request, env) {
  const { id, name, note } = await request.json();
  const now = new Date().toISOString();
  await env.DB.prepare('UPDATE budget_history SET name = ?, note = ?, modified_date = ? WHERE id = ?')
    .bind(sv(name), sv(note), now, iv(id)).run();
  return json({ success: true });
}

async function handleDeleteHistory(path, env) {
  const id = iv(path.split('/').pop());
  await env.DB.prepare('DELETE FROM budget_history WHERE id = ?').bind(id).run();
  return json({ success: true });
}

// ── PAYMENT HANDLERS ──────────────────────────────────────────

async function handleSavePayment(request, env) {
  const p = await request.json();
  const now = new Date().toISOString();
  const id = iv(p.id);

  if (id) {
    const existing = await env.DB.prepare('SELECT created_date FROM regular_payments WHERE id = ?').bind(id).first();
    await env.DB.prepare(`
      UPDATE regular_payments SET
        name = ?, schedule = ?, date = ?, amount = ?, variation = ?,
        status = ?, type = ?, importance = ?, account_partition_id = ?, modified_date = ?
      WHERE id = ?
    `).bind(
      sv(p.name) || 'Unnamed',
      ev(p.schedule,  ['Monthly','Weekly','Daily','Yearly','Other'], 'Monthly'),
      sv(p.date),
      nv(p.amount), nv(p.variation),
      ev(p.status,    ['Active','Inactive','Cancelled'], 'Active'),
      ev(p.type,      ['Auto','Manual'], 'Auto'),
      ev(p.importance,['Mandatory','Needed','Optional'], 'Mandatory'),
      iv(p.account_partition_id) || null,
      now, id
    ).run();
    return json({ success: true, id });
  } else {
    const result = await env.DB.prepare(`
      INSERT INTO regular_payments (name, schedule, date, amount, variation, status, type, importance, account_partition_id, modified_date, created_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      sv(p.name) || 'Unnamed',
      ev(p.schedule,  ['Monthly','Weekly','Daily','Yearly','Other'], 'Monthly'),
      sv(p.date),
      nv(p.amount), nv(p.variation),
      ev(p.status,    ['Active','Inactive','Cancelled'], 'Active'),
      ev(p.type,      ['Auto','Manual'], 'Auto'),
      ev(p.importance,['Mandatory','Needed','Optional'], 'Mandatory'),
      iv(p.account_partition_id) || null,
      now, now
    ).run();
    return json({ success: true, id: result.meta.last_row_id });
  }
}

async function handleDeletePayment(path, env) {
  const id = iv(path.split('/').pop());
  await env.DB.prepare('DELETE FROM regular_payments WHERE id = ?').bind(id).run();
  return json({ success: true });
}

// ── PARTITION HANDLERS ────────────────────────────────────────

async function handleSavePartition(request, env) {
  const p = await request.json();
  const now = new Date().toISOString();
  const id = iv(p.id);

  if (id) {
    await env.DB.prepare(`
      UPDATE account_partition SET partition_name = ?, bank = ?, cards_id = ?, status = ?, modified_date = ? WHERE id = ?
    `).bind(sv(p.partition_name) || 'Unnamed', sv(p.bank), iv(p.cards_id) || null, ev(p.status, ['Active','Inactive'], 'Active'), now, id).run();
    return json({ success: true, id });
  } else {
    const result = await env.DB.prepare(`
      INSERT INTO account_partition (partition_name, bank, cards_id, status, modified_date, created_date) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(sv(p.partition_name) || 'Unnamed', sv(p.bank), iv(p.cards_id) || null, ev(p.status, ['Active','Inactive'], 'Active'), now, now).run();
    return json({ success: true, id: result.meta.last_row_id });
  }
}

async function handleDeletePartition(path, env) {
  const id = iv(path.split('/').pop());
  await env.DB.prepare('DELETE FROM account_partition WHERE id = ?').bind(id).run();
  return json({ success: true });
}

// ── ACCOUNT HANDLERS ──────────────────────────────────────────

async function handleSaveAccount(request, env) {
  const a = await request.json();
  const now = new Date().toISOString();
  const id = iv(a.id);

  if (id) {
    await env.DB.prepare('UPDATE account SET bank = ?, modified_date = ? WHERE id = ?')
      .bind(sv(a.bank) || 'Unknown', now, id).run();
    return json({ success: true, id });
  } else {
    const result = await env.DB.prepare('INSERT INTO account (bank, modified_date, created_date) VALUES (?, ?, ?)')
      .bind(sv(a.bank) || 'Unknown', now, now).run();
    return json({ success: true, id: result.meta.last_row_id });
  }
}

async function handleDeleteAccount(path, env) {
  const id = iv(path.split('/').pop());
  await env.DB.prepare('DELETE FROM account WHERE id = ?').bind(id).run();
  return json({ success: true });
}

// ── CARD HANDLERS ─────────────────────────────────────────────

async function handleSaveCard(request, env) {
  const c = await request.json();
  const now = new Date().toISOString();
  const id = iv(c.id);

  if (id) {
    await env.DB.prepare(`
      UPDATE cards SET card_name = ?, account_id = ?, account_partition_id = ?, modified_date = ? WHERE id = ?
    `).bind(sv(c.card_name) || 'Card', iv(c.account_id) || null, iv(c.account_partition_id) || null, now, id).run();
    return json({ success: true, id });
  } else {
    const result = await env.DB.prepare(`
      INSERT INTO cards (card_name, account_id, account_partition_id, modified_date, created_date) VALUES (?, ?, ?, ?, ?)
    `).bind(sv(c.card_name) || 'Card', iv(c.account_id) || null, iv(c.account_partition_id) || null, now, now).run();
    return json({ success: true, id: result.meta.last_row_id });
  }
}

async function handleDeleteCard(path, env) {
  const id = iv(path.split('/').pop());
  await env.DB.prepare('DELETE FROM cards WHERE id = ?').bind(id).run();
  return json({ success: true });
}
