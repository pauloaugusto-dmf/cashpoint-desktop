// src/preload/index.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Overview
  getOverview: () => ipcRenderer.invoke('finance:getOverview'),

  // Accounts
  getAccounts: () => ipcRenderer.invoke('accounts:get'),
  addAccount: (account) => ipcRenderer.invoke('accounts:add', account),
  updateAccount: (id, account) => ipcRenderer.invoke('accounts:update', id, account),
  deleteAccount: (id) => ipcRenderer.invoke('accounts:delete', id),

  // Credit Cards
  getCreditCards: () => ipcRenderer.invoke('cards:get'),
  addCreditCard: (card) => ipcRenderer.invoke('cards:add', card),
  updateCreditCard: (id, card) => ipcRenderer.invoke('cards:update', id, card),
  deleteCreditCard: (id) => ipcRenderer.invoke('cards:delete', id),

  // Categories
  getCategories: () => ipcRenderer.invoke('categories:get'),
  addCategory: (category) => ipcRenderer.invoke('categories:add', category),
  updateCategory: (id, category) => ipcRenderer.invoke('categories:update', id, category),
  deleteCategory: (id) => ipcRenderer.invoke('categories:delete', id),

  // Expenses
  getExpenses: () => ipcRenderer.invoke('expenses:get'),
  addExpense: (expense) => ipcRenderer.invoke('expenses:add', expense),
  updateExpense: (id, expense) => ipcRenderer.invoke('expenses:update', id, expense),
  toggleExpensePaid: (id, isPaid) => ipcRenderer.invoke('expenses:togglePaid', id, isPaid),
  toggleExpenseActive: (id, isActive) => ipcRenderer.invoke('expenses:toggleActive', id, isActive),
  deleteExpense: (id) => ipcRenderer.invoke('expenses:delete', id),

  // Backup & Restore
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
});

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
});
