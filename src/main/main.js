// src/main/main.js
const { app, BrowserWindow, Menu, MenuItem } = require('electron');
const path = require('path');
const { setupIpcHandlers } = require('./ipcHandlers');
const { initDatabase } = require('./sqlite');

let mainWindow;

app.disableHardwareAcceleration();

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#121212',
    icon: path.join(app.getAppPath(), 'src', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  // Configura idiomas do corretor ortográfico (Português Brasil + Inglês)
  try {
    const available = mainWindow.webContents.session.availableSpellCheckerLanguages || [];
    const desired = ['pt-BR', 'en-US'].filter(lang => available.includes(lang));
    if (desired.length > 0) {
      mainWindow.webContents.session.setSpellCheckerLanguages(desired);
    }
  } catch (err) {
    console.warn('[Cashpoint] Não foi possível configurar idiomas do corretor:', err.message);
  }

  // Menu de contexto (botão direito) com sugestões de ortografia e edição de texto
  mainWindow.webContents.on('context-menu', (event, params) => {
    const menu = new Menu();

    if (params.misspelledWord) {
      if (params.dictionarySuggestions && params.dictionarySuggestions.length > 0) {
        for (const suggestion of params.dictionarySuggestions) {
          menu.append(new MenuItem({
            label: suggestion,
            click: () => mainWindow.webContents.replaceMisspelling(suggestion),
          }));
        }
      } else {
        menu.append(new MenuItem({
          label: 'Sem sugestões',
          enabled: false,
        }));
      }

      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({
        label: `Adicionar "${params.misspelledWord}" ao dicionário`,
        click: () => mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      }));
    }

    if (params.isEditable || params.selectionText) {
      if (menu.items.length > 0) {
        menu.append(new MenuItem({ type: 'separator' }));
      }
      if (params.isEditable) {
        menu.append(new MenuItem({
          label: 'Recortar',
          role: 'cut',
          enabled: params.editFlags.canCut,
        }));
      }
      if (params.selectionText) {
        menu.append(new MenuItem({
          label: 'Copiar',
          role: 'copy',
          enabled: params.editFlags.canCopy,
        }));
      }
      if (params.isEditable) {
        menu.append(new MenuItem({
          label: 'Colar',
          role: 'paste',
          enabled: params.editFlags.canPaste,
        }));
        menu.append(new MenuItem({ type: 'separator' }));
        menu.append(new MenuItem({
          label: 'Selecionar tudo',
          role: 'selectAll',
          enabled: params.editFlags.canSelectAll,
        }));
      }
    }

    if (menu.items.length > 0) {
      menu.popup({ window: mainWindow });
    }
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'renderer', 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  try {
    console.log('[Cashpoint] Starting database...');
    await initDatabase();

    console.log('[Cashpoint] Registering IPC handlers...');
    setupIpcHandlers();

    console.log('[Cashpoint] Creating window...');
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('[Cashpoint] Startup error:', error);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
