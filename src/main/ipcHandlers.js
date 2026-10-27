// src/main/ipcHandlers.js
const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const db = require('./sqlite');

function setupIpcHandlers() {
  // Overview
  ipcMain.handle('finance:getOverview', async () => await db.getOverview());

  // Accounts
  ipcMain.handle('accounts:get', async () => await db.getAccounts());
  ipcMain.handle('accounts:add', async (event, account) => await db.addAccount(account));
  ipcMain.handle('accounts:update', async (event, id, account) => await db.updateAccount(id, account));
  ipcMain.handle('accounts:delete', async (event, id) => await db.deleteAccount(id));

  // Credit Cards
  ipcMain.handle('cards:get', async () => await db.getCreditCards());
  ipcMain.handle('cards:add', async (event, card) => await db.addCreditCard(card));
  ipcMain.handle('cards:update', async (event, id, card) => await db.updateCreditCard(id, card));
  ipcMain.handle('cards:delete', async (event, id) => await db.deleteCreditCard(id));

  // Categories
  ipcMain.handle('categories:get', async () => await db.getCategories());
  ipcMain.handle('categories:add', async (event, category) => await db.addCategory(category));
  ipcMain.handle('categories:update', async (event, id, category) => await db.updateCategory(id, category));
  ipcMain.handle('categories:delete', async (event, id) => await db.deleteCategory(id));

  // Expenses
  ipcMain.handle('expenses:get', async () => await db.getExpenses());
  ipcMain.handle('expenses:add', async (event, expense) => await db.addExpense(expense));
  ipcMain.handle('expenses:update', async (event, id, expense) => await db.updateExpense(id, expense));
  ipcMain.handle('expenses:togglePaid', async (event, id, isPaid) => await db.toggleExpensePaid(id, isPaid));
  ipcMain.handle('expenses:toggleActive', async (event, id, isActive) => await db.toggleExpenseActive(id, isActive));
  ipcMain.handle('expenses:delete', async (event, id) => await db.deleteExpense(id));

  // Backup & Restore
  ipcMain.handle('data:export', async () => {
    const data = await db.getAllData();
    const dateStr = new Date().toISOString().split('T')[0];
    const { filePath } = await dialog.showSaveDialog({
      title: 'Exportar Backup Financeiro',
      defaultPath: `cashpoint_backup_${dateStr}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (filePath) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    }
    return false;
  });

  ipcMain.handle('data:import', async () => {
    const { filePaths } = await dialog.showOpenDialog({
      title: 'Importar Backup Financeiro',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (filePaths && filePaths.length > 0) {
      const content = fs.readFileSync(filePaths[0], 'utf-8');
      const data = JSON.parse(content);
      await db.importData(data);
      return true;
    }
    return false;
  });

  // Window Controls (frameless titlebar)
  ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win.minimize();
  });

  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win.close();
  });
}

module.exports = { setupIpcHandlers };
