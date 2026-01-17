const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { startApiServer } = require('./api/server');
const { logger } = require('./utils/logger');
const { getPrinterManager } = require('./printer/printer-manager');
const settings = require('./config/settings');

// Auto-updater (only in production builds)
let autoUpdater = null;
if (app.isPackaged) {
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
  } catch (e) {
    logger.warn('Auto-updater not available:', e.message);
  }
}

let mainWindow;
let wizardWindow;
let apiServer;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, '../build/icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();
}

function createWizardWindow() {
  wizardWindow = new BrowserWindow({
    width: 650,
    height: 700,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'wizard/preload.js')
    },
    icon: path.join(__dirname, '../build/icon.png')
  });

  wizardWindow.loadFile(path.join(__dirname, 'wizard/wizard.html'));

  // Remove menu for wizard
  wizardWindow.setMenu(null);

  wizardWindow.on('closed', () => {
    wizardWindow = null;
    // If wizard closed without completing, quit app
    if (!settings.isSetupCompleted()) {
      app.quit();
    }
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Run Setup Wizard',
          click: () => {
            if (!wizardWindow) {
              createWizardWindow();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            if (autoUpdater) {
              autoUpdater.checkForUpdates().then(result => {
                if (!result || !result.updateInfo) {
                  const { dialog } = require('electron');
                  dialog.showMessageBox({
                    type: 'info',
                    title: 'No Updates',
                    message: 'You are running the latest version.',
                    buttons: ['OK']
                  });
                }
              }).catch(err => {
                logger.warn('Manual update check failed:', err.message);
                const { dialog } = require('electron');
                dialog.showMessageBox({
                  type: 'error',
                  title: 'Update Check Failed',
                  message: `Could not check for updates: ${err.message}`,
                  buttons: ['OK']
                });
              });
            } else {
              const { dialog } = require('electron');
              dialog.showMessageBox({
                type: 'info',
                title: 'Development Mode',
                message: 'Update checking is only available in packaged builds.\n\nRun "bun run build:win" to create an installer with auto-update support.',
                buttons: ['OK']
              });
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers for wizard
ipcMain.handle('save-config', async (event, config) => {
  try {
    if (config.printer) {
      settings.savePrinter(config.printer);
    }
    if (config.network) {
      settings.saveNetworkSettings(config.network);
    }
    if (config.defaults) {
      settings.saveDefaultPageConfig(config.defaults.pageConfig);
    }
    if (config.startup) {
      settings.saveStartupSettings(config.startup);

      // Handle auto-launch
      if (config.startup.launchOnBoot) {
        try {
          const AutoLaunch = require('electron-auto-launch');
          const autoLauncher = new AutoLaunch({
            name: 'Label Printer Server',
            isHidden: config.startup.startMinimized
          });
          await autoLauncher.enable();
        } catch (e) {
          logger.warn('Could not enable auto-launch:', e.message);
        }
      }
    }

    settings.completeSetup();
    return { success: true };
  } catch (error) {
    logger.error('Error saving config:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('wizard-complete', async () => {
  if (wizardWindow) {
    wizardWindow.close();
  }

  // Connect to saved printer
  const savedPrinter = settings.getSavedPrinter();
  if (savedPrinter) {
    try {
      const printerManager = getPrinterManager();
      printerManager.connect({
        vendorId: savedPrinter.vendorId,
        productId: savedPrinter.productId
      });
      logger.info('Connected to saved printer');
    } catch (e) {
      logger.warn('Could not connect to saved printer:', e.message);
    }
  }

  // Show main window
  createMainWindow();
});

ipcMain.handle('get-config', () => {
  return settings.getConfig();
});

// Setup auto-updater events
function setupAutoUpdater() {
  if (!autoUpdater) return;

  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    logger.info('Update available:', info.version);
    const { dialog } = require('electron');
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available and will be downloaded automatically.`,
      buttons: ['OK']
    });
  });

  autoUpdater.on('update-not-available', () => {
    logger.info('No updates available');
  });

  autoUpdater.on('download-progress', (progress) => {
    logger.info(`Download progress: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    logger.info('Update downloaded:', info.version);
    const { dialog } = require('electron');
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded and will be installed when you quit the app.`,
      buttons: ['OK', 'Restart Now']
    }).then(result => {
      if (result.response === 1) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    logger.error('Auto-updater error:', err.message);
  });
}

app.whenReady().then(async () => {
  try {
    // Load settings
    settings.loadConfig();

    // Get configured port
    const networkSettings = settings.getNetworkSettings();
    const port = networkSettings?.port || 9632;

    // Start API server
    apiServer = await startApiServer(port);
    logger.info(`API Server started on port ${apiServer.port}`);

    // Setup auto-updater
    setupAutoUpdater();

    // Check for updates (silent, in background)
    if (autoUpdater) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch(err => {
          logger.warn('Update check failed:', err.message);
        });
      }, 3000); // Delay to allow app to fully start
    }

    // Check if setup wizard needs to run
    if (!settings.isSetupCompleted()) {
      createWizardWindow();
    } else {
      // Try to auto-connect to saved printer
      const savedPrinter = settings.getSavedPrinter();
      if (savedPrinter) {
        try {
          const printerManager = getPrinterManager();
          printerManager.connect({
            vendorId: savedPrinter.vendorId,
            productId: savedPrinter.productId
          });
          logger.info('Auto-connected to saved printer');
        } catch (e) {
          logger.warn('Could not auto-connect to printer:', e.message);
        }
      }

      // Create main window
      createMainWindow();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        if (settings.isSetupCompleted()) {
          createMainWindow();
        } else {
          createWizardWindow();
        }
      }
    });
  } catch (error) {
    logger.error('Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (apiServer) {
    apiServer.close();
    logger.info('API Server stopped');
  }
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});
