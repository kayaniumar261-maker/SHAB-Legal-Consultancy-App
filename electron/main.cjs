const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');
const { startDesktopUpdater } = require('./updater.cjs');
const { isExternalWebUrl, isAppDocument } = require('./navigation.cjs');

const createMainWindow = () => {
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#f8fafc',
    title: 'SHAB Legal Consultants FZC',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    startDesktopUpdater(mainWindow);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalWebUrl(url)) {
      void shell.openExternal(url).catch((error) => console.error('Unable to open external link:', error));
    }

    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAppDocument(url, indexPath)) return;
    event.preventDefault();
    if (isExternalWebUrl(url)) {
      void shell.openExternal(url).catch((error) => console.error('Unable to open external link:', error));
    }
  });

  void mainWindow.loadFile(
    indexPath,
  );
};

app.setAppUserModelId('com.shab.legalconsultancy');

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
