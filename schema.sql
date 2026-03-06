-- ============================================================
-- Budget App — D1 Database Schema
-- ============================================================

-- Users (you create these manually via SQL or the admin route)
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bank accounts (e.g. Starling, Monzo)
CREATE TABLE IF NOT EXISTS account (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  bank          TEXT NOT NULL,
  modified_date DATETIME,
  created_date  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Spaces / pots within a bank account
CREATE TABLE IF NOT EXISTS account_partition (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  partition_name TEXT NOT NULL,
  bank           TEXT NOT NULL,
  cards_id       INTEGER,
  status         TEXT DEFAULT 'Active',
  modified_date  DATETIME,
  created_date   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cards linked to accounts
CREATE TABLE IF NOT EXISTS cards (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  card_name            TEXT NOT NULL,
  account_id           INTEGER,
  account_partition_id INTEGER,
  modified_date        DATETIME,
  created_date         DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Regular recurring payments
CREATE TABLE IF NOT EXISTS regular_payments (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  name                 TEXT NOT NULL,
  schedule             TEXT DEFAULT 'Monthly',
  date                 TEXT,
  amount               REAL DEFAULT 0,
  variation            REAL DEFAULT 0,
  status               TEXT DEFAULT 'Active',
  type                 TEXT DEFAULT 'Auto',
  importance           TEXT DEFAULT 'Mandatory',
  account_partition_id INTEGER,
  modified_date        DATETIME,
  created_date         DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- The single active budget period
CREATE TABLE IF NOT EXISTS active_budget (
  id             INTEGER PRIMARY KEY DEFAULT 1,
  period_start   DATE,
  period_end     DATE,
  income         REAL DEFAULT 0,
  bills_json     TEXT DEFAULT '[]',
  oneoff_json    TEXT DEFAULT '[]',
  overrides_json TEXT DEFAULT '{}',
  modified_date  DATETIME,
  created_date   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Saved budget history snapshots
CREATE TABLE IF NOT EXISTS budget_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT DEFAULT '',
  note          TEXT DEFAULT '',
  snapshot_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  period_start  DATE,
  period_end    DATE,
  income        REAL DEFAULT 0,
  bills_json    TEXT DEFAULT '[]',
  oneoff_json   TEXT DEFAULT '[]',
  modified_date DATETIME,
  created_date  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Month type thresholds (LOW / AVERAGE / HIGH / NEGATIVE)
CREATE TABLE IF NOT EXISTS month_types (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  more_than REAL,
  less_than REAL
);

-- App-wide defaults (income, period start, etc.)
CREATE TABLE IF NOT EXISTS defaults (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT UNIQUE NOT NULL,
  default_value TEXT
);

-- ── SEED DATA ──────────────────────────────────────────────

INSERT OR IGNORE INTO month_types (id, name, more_than, less_than) VALUES
  (1, 'NEGATIVE', NULL, 0),
  (2, 'LOW',      0,    200),
  (3, 'AVERAGE',  200,  400),
  (4, 'HIGH',     400,  NULL);

INSERT OR IGNORE INTO defaults (name, default_value) VALUES
  ('Income',       '3550'),
  ('Period Start', 'today');

-- ── YOUR EXISTING DATA ─────────────────────────────────────

INSERT OR IGNORE INTO account (id, bank) VALUES
  (1, 'Starling'),
  (2, 'Monzo');

INSERT OR IGNORE INTO account_partition (id, partition_name, bank, cards_id, status) VALUES
  (1, 'Bills',         'Starling', 3, 'Active'),
  (2, 'Groceries',     'Starling', 4, 'Active'),
  (3, 'Subscriptions', 'Starling', 5, 'Active'),
  (4, 'Savings',       'Monzo',    1, 'Active'),
  (5, 'Adhoc',         'Starling', 6, 'Active'),
  (6, 'Misc',          'Starling', 1, 'Active');

INSERT OR IGNORE INTO cards (id, card_name, account_id, account_partition_id) VALUES
  (1, 'Main (Starling)', 1, 6),
  (2, 'Main (Monzo)',    2, NULL),
  (3, 'Bills',          1, 1),
  (4, 'Groceries',      1, 2),
  (5, 'Subscriptions',  1, 3),
  (6, 'Adhoc',          1, 5),
  (7, 'High-Risk',      1, NULL);

INSERT OR IGNORE INTO regular_payments (id, name, schedule, date, amount, variation, status, type, importance, account_partition_id) VALUES
  (1,  'Rent',               'Monthly', '1st',     1000.00, 0.00,  'Active',   'Auto',   'Mandatory', 3),
  (2,  'Bills',              'Monthly', NULL,          0.00, 0.00,  'Active',   'Auto',   'Mandatory', 3),
  (3,  'Debt',               'Monthly', '2nd',       200.00, 0.00,  'Active',   'Auto',   'Mandatory', 3),
  (4,  'Car Insurance',      'Monthly', NULL,        100.00, 70.00, 'Active',   'Auto',   'Mandatory', 3),
  (5,  'Pet Insurance',      'Monthly', '2st',        16.56, 0.00,  'Active',   'Auto',   'Mandatory', 3),
  (6,  'Dog Food',           'Monthly', NULL,        156.27, 20.00, 'Active',   'Auto',   'Mandatory', 3),
  (7,  'Groceries',          'Monthly', NULL,        250.00, 50.00, 'Active',   'Manual', 'Mandatory', 2),
  (8,  'Phone',              'Monthly', '3rd',        15.93, 5.00,  'Active',   'Auto',   'Needed',    3),
  (9,  'Proton',             'Monthly', '13th',       10.39, 0.00,  'Active',   'Auto',   'Needed',    3),
  (10, 'Amazon Prime',       'Monthly', NULL,          8.99, 0.00,  'Inactive', 'Auto',   'Optional',  3),
  (11, 'iCloud',             'Monthly', '26th',        2.99, 0.00,  'Active',   'Auto',   'Needed',    3),
  (12, 'Now TV',             'Monthly', NULL,         34.99, 0.00,  'Inactive', 'Auto',   'Optional',  3),
  (13, 'Youtube',            'Monthly', '1st',        10.00, 0.00,  'Active',   'Auto',   'Needed',    3),
  (14, 'Savings',            'Monthly', NULL,        200.00, 0.00,  'Active',   'Manual', 'Optional',  4),
  (15, 'Vape',               'Monthly', NULL,        140.00, 0.00,  'Active',   'Manual', 'Mandatory', 5),
  (16, 'Haircut',            'Monthly', NULL,         75.00, 30.00, 'Active',   'Manual', 'Optional',  5),
  (17, 'Driving Lessons',    'Weekly',  'Monday',     70.00, 0.00,  'Inactive', 'Manual', 'Needed',    5),
  (18, 'George',             'Monthly', NULL,        150.00, 0.00,  'Active',   'Manual', 'Needed',    5),
  (19, 'Daily Budget',       'Daily',   'All',        30.00, 0.00,  'Active',   'Manual', 'Mandatory', 6),
  (20, 'Cloudflare @jaminbox','Yearly', 'Jan 14th',    7.82, 3.00,  'Active',   'Auto',   'Mandatory', 1),
  (21, 'Cloudflare @trailmail','Yearly','Jan 14th',    3.96, 3.00,  'Active',   'Auto',   'Mandatory', 1),
  (22, 'Ella Payback',       'Monthly', '1st',       200.00, 0.00,  'Active',   'Manual', 'Needed',    5),
  (23, 'April',              'Monthly', '24th',       12.00, 2.00,  'Active',   'Auto',   'Mandatory', 3);