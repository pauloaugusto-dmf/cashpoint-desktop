// src/main/sqlite.js
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const { app } = require('electron');

const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'cashpoint.sqlite');

console.log('[Cashpoint DB] Database path:', dbPath);

let dbInstance = null;

async function initDatabase() {
  if (dbInstance) return dbInstance;

  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await dbInstance.exec('PRAGMA foreign_keys = ON;');

  // Accounts
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      balance_cents INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Credit Cards
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS credit_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      limit_cents INTEGER NOT NULL DEFAULT 0,
      closing_day INTEGER NOT NULL CHECK (closing_day >= 1 AND closing_day <= 31),
      due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Categories
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Expenses
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      target_type TEXT NOT NULL CHECK (target_type IN ('account', 'card')),
      account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
      credit_card_id INTEGER REFERENCES credit_cards(id) ON DELETE CASCADE,
      frequency_type TEXT NOT NULL CHECK (frequency_type IN ('recurring', 'installment', 'one_time')),
      amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
      current_installment INTEGER,
      total_installments INTEGER,
      due_day INTEGER CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31)),
      is_paid INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      competence_month TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  const expCols = await dbInstance.all("PRAGMA table_info(expenses);");
  const expColNames = expCols.map(c => c.name);
  if (!expColNames.includes('is_active')) {
    await dbInstance.run("ALTER TABLE expenses ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;");
  }
  if (!expColNames.includes('competence_month')) {
    await dbInstance.run("ALTER TABLE expenses ADD COLUMN competence_month TEXT;");
  }

  // Preenche competência para registros antigos com base no created_at
  await dbInstance.run(`
    UPDATE expenses
    SET competence_month = strftime('%Y-%m', created_at)
    WHERE competence_month IS NULL OR competence_month = '';
  `);

  // Seed default categories if none exist
  const categoriesCount = await dbInstance.get('SELECT COUNT(*) as count FROM categories;');
  if (categoriesCount && categoriesCount.count === 0) {
    const defaults = [
      ['Alimentação', '#f97316'],
      ['Moradia', '#3b82f6'],
      ['Transporte', '#eab308'],
      ['Lazer & Assinaturas', '#8b5cf6'],
      ['Saúde', '#10b981'],
      ['Outros', '#6b7280']
    ];
    for (const [name, color] of defaults) {
      await dbInstance.run('INSERT INTO categories (name, color) VALUES (?, ?);', [name, color]);
    }
  }

  return dbInstance;
}

// Overview query
async function getOverview() {
  const db = await initDatabase();
  const accounts = await db.all('SELECT * FROM accounts ORDER BY name ASC;');
  const creditCards = await db.all('SELECT * FROM credit_cards ORDER BY name ASC;');
  const categories = await db.all('SELECT * FROM categories ORDER BY name ASC;');
  const expenses = await db.all(`
    SELECT 
      e.*,
      c.name as category_name,
      c.color as category_color,
      a.name as account_name,
      cc.name as credit_card_name
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    LEFT JOIN accounts a ON e.account_id = a.id
    LEFT JOIN credit_cards cc ON e.credit_card_id = cc.id
    ORDER BY e.created_at DESC;
  `);

  return { accounts, creditCards, categories, expenses };
}

// Accounts
async function getAccounts() {
  const db = await initDatabase();
  return await db.all('SELECT * FROM accounts ORDER BY name ASC;');
}

async function addAccount({ name, balance_cents }) {
  const db = await initDatabase();
  const res = await db.run(
    'INSERT INTO accounts (name, balance_cents) VALUES (?, ?);',
    [name, balance_cents || 0]
  );
  return res.lastID;
}

async function updateAccount(id, { name, balance_cents }) {
  const db = await initDatabase();
  await db.run(
    "UPDATE accounts SET name = ?, balance_cents = ?, updated_at = datetime('now', 'localtime') WHERE id = ?;",
    [name, balance_cents, id]
  );
}

async function deleteAccount(id) {
  const db = await initDatabase();
  await db.run('DELETE FROM accounts WHERE id = ?;', [id]);
}

// Credit Cards
async function getCreditCards() {
  const db = await initDatabase();
  return await db.all('SELECT * FROM credit_cards ORDER BY name ASC;');
}

async function addCreditCard({ name, limit_cents, closing_day, due_day }) {
  const db = await initDatabase();
  const res = await db.run(
    'INSERT INTO credit_cards (name, limit_cents, closing_day, due_day) VALUES (?, ?, ?, ?);',
    [name, limit_cents || 0, closing_day, due_day]
  );
  return res.lastID;
}

async function updateCreditCard(id, { name, limit_cents, closing_day, due_day }) {
  const db = await initDatabase();
  await db.run(
    "UPDATE credit_cards SET name = ?, limit_cents = ?, closing_day = ?, due_day = ?, updated_at = datetime('now', 'localtime') WHERE id = ?;",
    [name, limit_cents, closing_day, due_day, id]
  );
}

async function deleteCreditCard(id) {
  const db = await initDatabase();
  await db.run('DELETE FROM credit_cards WHERE id = ?;', [id]);
}

// Categories
async function getCategories() {
  const db = await initDatabase();
  return await db.all('SELECT * FROM categories ORDER BY name ASC;');
}

async function addCategory({ name, color }) {
  const db = await initDatabase();
  const res = await db.run('INSERT INTO categories (name, color) VALUES (?, ?);', [name, color]);
  return res.lastID;
}

async function updateCategory(id, { name, color }) {
  const db = await initDatabase();
  await db.run(
    "UPDATE categories SET name = ?, color = ?, updated_at = datetime('now', 'localtime') WHERE id = ?;",
    [name, color, id]
  );
}

async function deleteCategory(id) {
  const db = await initDatabase();
  await db.run('DELETE FROM categories WHERE id = ?;', [id]);
}

// Expenses
async function getExpenses() {
  const db = await initDatabase();
  return await db.all(`
    SELECT 
      e.*,
      c.name as category_name,
      c.color as category_color,
      a.name as account_name,
      cc.name as credit_card_name
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    LEFT JOIN accounts a ON e.account_id = a.id
    LEFT JOIN credit_cards cc ON e.credit_card_id = cc.id
    ORDER BY e.created_at DESC;
  `);
}

async function addExpense(payload) {
  const db = await initDatabase();
  const {
    category_id = null,
    description,
    target_type,
    account_id = null,
    credit_card_id = null,
    frequency_type = 'one_time',
    amount_cents,
    current_installment = null,
    total_installments = null,
    due_day = null,
    is_paid = 0,
    is_active = 1,
    competence_month = null
  } = payload;

  const res = await db.run(`
    INSERT INTO expenses (
      category_id, description, target_type, account_id, credit_card_id,
      frequency_type, amount_cents, current_installment, total_installments,
      due_day, is_paid, is_active, competence_month
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `, [
    category_id, description, target_type, account_id, credit_card_id,
    frequency_type, amount_cents, current_installment, total_installments,
    due_day, is_paid ? 1 : 0, is_active !== 0 ? 1 : 0, competence_month || null
  ]);

  return res.lastID;
}

async function updateExpense(id, payload) {
  const db = await initDatabase();
  const {
    category_id = null,
    description,
    target_type,
    account_id = null,
    credit_card_id = null,
    frequency_type = 'one_time',
    amount_cents,
    current_installment = null,
    total_installments = null,
    due_day = null,
    is_paid = 0,
    is_active = 1,
    competence_month = null
  } = payload;

  await db.run(`
    UPDATE expenses SET
      category_id = ?,
      description = ?,
      target_type = ?,
      account_id = ?,
      credit_card_id = ?,
      frequency_type = ?,
      amount_cents = ?,
      current_installment = ?,
      total_installments = ?,
      due_day = ?,
      is_paid = ?,
      is_active = ?,
      competence_month = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?;
  `, [
    category_id || null,
    description,
    target_type,
    account_id || null,
    credit_card_id || null,
    frequency_type,
    amount_cents,
    current_installment || null,
    total_installments || null,
    due_day || null,
    is_paid ? 1 : 0,
    is_active !== 0 ? 1 : 0,
    competence_month || null,
    id
  ]);
}

async function toggleExpensePaid(id, is_paid) {
  const db = await initDatabase();
  await db.run(
    "UPDATE expenses SET is_paid = ?, updated_at = datetime('now', 'localtime') WHERE id = ?;",
    [is_paid ? 1 : 0, id]
  );
}

async function toggleExpenseActive(id, is_active) {
  const db = await initDatabase();
  await db.run(
    "UPDATE expenses SET is_active = ?, updated_at = datetime('now', 'localtime') WHERE id = ?;",
    [is_active ? 1 : 0, id]
  );
}

async function deleteExpense(id) {
  const db = await initDatabase();
  await db.run('DELETE FROM expenses WHERE id = ?;', [id]);
}

// Backup & Restore
async function getAllData() {
  const db = await initDatabase();
  const accounts = await db.all('SELECT * FROM accounts;');
  const creditCards = await db.all('SELECT * FROM credit_cards;');
  const categories = await db.all('SELECT * FROM categories;');
  const expenses = await db.all('SELECT * FROM expenses;');
  return { accounts, creditCards, categories, expenses, exportedAt: new Date().toISOString() };
}

async function importData(data) {
  const db = await initDatabase();
  await db.exec('BEGIN TRANSACTION;');
  try {
    await db.exec('DELETE FROM expenses;');
    await db.exec('DELETE FROM categories;');
    await db.exec('DELETE FROM credit_cards;');
    await db.exec('DELETE FROM accounts;');

    if (data.accounts?.length) {
      for (const a of data.accounts) {
        await db.run('INSERT INTO accounts (id, name, balance_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?);',
          [a.id, a.name, a.balance_cents, a.created_at, a.updated_at]);
      }
    }
    if (data.creditCards?.length) {
      for (const c of data.creditCards) {
        await db.run('INSERT INTO credit_cards (id, name, limit_cents, closing_day, due_day, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?);',
          [c.id, c.name, c.limit_cents, c.closing_day, c.due_day, c.created_at, c.updated_at]);
      }
    }
    if (data.categories?.length) {
      for (const cat of data.categories) {
        await db.run('INSERT INTO categories (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?);',
          [cat.id, cat.name, cat.color, cat.created_at, cat.updated_at]);
      }
    }
    if (data.expenses?.length) {
      for (const e of data.expenses) {
        await db.run(`INSERT INTO expenses (id, category_id, description, target_type, account_id, credit_card_id, frequency_type, amount_cents, current_installment, total_installments, due_day, is_paid, is_active, competence_month, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [e.id, e.category_id, e.description, e.target_type, e.account_id, e.credit_card_id, e.frequency_type, e.amount_cents, e.current_installment, e.total_installments, e.due_day, e.is_paid, e.is_active !== undefined ? e.is_active : 1, e.competence_month || null, e.created_at, e.updated_at]);
      }
    }
    await db.exec('COMMIT;');
    return true;
  } catch (err) {
    await db.exec('ROLLBACK;');
    throw err;
  }
}

module.exports = {
  initDatabase,
  getOverview,
  getAccounts,
  addAccount,
  updateAccount,
  deleteAccount,
  getCreditCards,
  addCreditCard,
  updateCreditCard,
  deleteCreditCard,
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  getExpenses,
  addExpense,
  updateExpense,
  toggleExpensePaid,
  toggleExpenseActive,
  deleteExpense,
  getAllData,
  importData
};
