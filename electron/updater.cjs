const { app, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

const CHECK_DELAY_MS = 8000;
let updateWindow = null;
let checkStarted = false;

const log = (message, detail) => {
  const suffix = detail ? ` ${detail}` : '';
  console.log(`[desktop-updater] ${message}${suffix}`);
};

const showMessage = async (options) => {
  if (!updateWindow || updateWindow.isDestroyed()) return { response: 1 };
  return dialog.showMessageBox(updateWindow, options);
};

const registerUpdaterEvents = () => {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = true;

  autoUpdater.on('checking-for-update', () => log('Checking for updates.'));
  autoUpdater.on('update-not-available', ({ version }) => {
    log(`Version ${version || app.getVersion()} is current.`);
  });

  autoUpdater.on('update-available', async ({ version }) => {
    log(`Update ${version} is available.`);
    const { response } = await showMessage({
      type: 'info',
      title: 'SHAB update available',
      message: `Version ${version} is available.`,
      detail: 'Would you like to download it now? You can continue working during the download.',
      buttons: ['Download update', 'Later'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });

    if (response === 0) {
      try {
        await autoUpdater.downloadUpdate();
      } catch (error) {
        log('Download failed.', error instanceof Error ? error.message : String(error));
      }
    }
  });

  autoUpdater.on('download-progress', ({ percent }) => {
    const progress = Math.max(0, Math.min(1, Number(percent || 0) / 100));
    if (updateWindow && !updateWindow.isDestroyed()) updateWindow.setProgressBar(progress);
    log(`Download progress ${Math.round(progress * 100)}%.`);
  });

  autoUpdater.on('update-downloaded', async ({ version }) => {
    if (updateWindow && !updateWindow.isDestroyed()) updateWindow.setProgressBar(-1);
    log(`Update ${version} downloaded.`);
    const { response } = await showMessage({
      type: 'info',
      title: 'Update ready to install',
      message: `SHAB version ${version} is ready.`,
      detail: 'Save any work, then install the update and restart the application.',
      buttons: ['Install and restart', 'Later'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });

    if (response === 0) autoUpdater.quitAndInstall(false, true);
  });

  autoUpdater.on('error', async (error) => {
    if (updateWindow && !updateWindow.isDestroyed()) updateWindow.setProgressBar(-1);
    const detail = error instanceof Error ? error.message : String(error);
    log('Update error.', detail);
    await showMessage({
      type: 'warning',
      title: 'Update check unavailable',
      message: 'SHAB could not complete the update check.',
      detail: 'The application will continue normally. Please check your internet connection and try again later.',
      buttons: ['OK'],
      defaultId: 0,
      noLink: true,
    });
  });
};

const startDesktopUpdater = (mainWindow) => {
  if (!app.isPackaged || process.platform !== 'win32' || checkStarted) {
    log('Updater disabled for this session.');
    return;
  }

  updateWindow = mainWindow;
  checkStarted = true;
  registerUpdaterEvents();

  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((error) => {
      log('Initial update check failed.', error instanceof Error ? error.message : String(error));
    });
  }, CHECK_DELAY_MS);
};

module.exports = { startDesktopUpdater };