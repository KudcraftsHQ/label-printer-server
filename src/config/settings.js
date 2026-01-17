const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = 'config.json';
const DEFAULT_CONFIG = {
  version: '1.0.0',
  printer: null,
  network: {
    port: 9632
  },
  defaults: {
    pageConfig: 'default',
    padding: 1.5,
    horizontalOffset: 0,
    verticalOffset: 0
  },
  startup: {
    launchOnBoot: false,
    startMinimized: false
  },
  setupCompleted: false
};

let config = null;
let configPath = null;

/**
 * Get the config file path
 */
function getConfigPath() {
  if (!configPath) {
    const userDataPath = app.getPath('userData');
    configPath = path.join(userDataPath, CONFIG_FILE);
  }
  return configPath;
}

/**
 * Load configuration from disk
 */
function loadConfig() {
  try {
    const filePath = getConfigPath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } else {
      config = { ...DEFAULT_CONFIG };
    }
  } catch (error) {
    console.error('Error loading config:', error);
    config = { ...DEFAULT_CONFIG };
  }
  return config;
}

/**
 * Save configuration to disk
 */
function saveConfig(newConfig) {
  try {
    const filePath = getConfigPath();
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    config = { ...config, ...newConfig };
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

/**
 * Get current configuration
 */
function getConfig() {
  if (!config) {
    loadConfig();
  }
  return config;
}

/**
 * Check if setup wizard has been completed
 */
function isSetupCompleted() {
  const cfg = getConfig();
  return cfg.setupCompleted === true;
}

/**
 * Mark setup as completed
 */
function completeSetup() {
  saveConfig({ setupCompleted: true });
}

/**
 * Get saved printer
 */
function getSavedPrinter() {
  const cfg = getConfig();
  return cfg.printer;
}

/**
 * Save printer selection
 */
function savePrinter(printer) {
  saveConfig({ printer });
}

/**
 * Get network settings
 */
function getNetworkSettings() {
  const cfg = getConfig();
  return cfg.network;
}

/**
 * Save network settings
 */
function saveNetworkSettings(network) {
  saveConfig({ network });
}

/**
 * Get startup settings
 */
function getStartupSettings() {
  const cfg = getConfig();
  return cfg.startup;
}

/**
 * Save startup settings
 */
function saveStartupSettings(startup) {
  saveConfig({ startup });
}

/**
 * Get default page config
 */
function getDefaultPageConfig() {
  const cfg = getConfig();
  return cfg.defaults?.pageConfig || 'default';
}

/**
 * Save default page config
 */
function saveDefaultPageConfig(pageConfig) {
  const cfg = getConfig();
  saveConfig({
    defaults: { ...cfg.defaults, pageConfig }
  });
}

/**
 * Get default padding (in mm)
 */
function getDefaultPadding() {
  const cfg = getConfig();
  return cfg.defaults?.padding ?? 1.5;
}

/**
 * Save default padding (in mm)
 */
function saveDefaultPadding(padding) {
  const cfg = getConfig();
  saveConfig({
    defaults: { ...cfg.defaults, padding }
  });
}

/**
 * Get horizontal offset (in mm) - for printer calibration
 */
function getHorizontalOffset() {
  const cfg = getConfig();
  return cfg.defaults?.horizontalOffset ?? 0;
}

/**
 * Save horizontal offset (in mm)
 */
function saveHorizontalOffset(horizontalOffset) {
  const cfg = getConfig();
  saveConfig({
    defaults: { ...cfg.defaults, horizontalOffset }
  });
}

/**
 * Get vertical offset (in mm) - for printer calibration
 */
function getVerticalOffset() {
  const cfg = getConfig();
  return cfg.defaults?.verticalOffset ?? 0;
}

/**
 * Save vertical offset (in mm)
 */
function saveVerticalOffset(verticalOffset) {
  const cfg = getConfig();
  saveConfig({
    defaults: { ...cfg.defaults, verticalOffset }
  });
}

/**
 * Reset configuration to defaults
 */
function resetConfig() {
  config = { ...DEFAULT_CONFIG };
  saveConfig(config);
}

module.exports = {
  loadConfig,
  saveConfig,
  getConfig,
  isSetupCompleted,
  completeSetup,
  getSavedPrinter,
  savePrinter,
  getNetworkSettings,
  saveNetworkSettings,
  getStartupSettings,
  saveStartupSettings,
  getDefaultPageConfig,
  saveDefaultPageConfig,
  getDefaultPadding,
  saveDefaultPadding,
  getHorizontalOffset,
  saveHorizontalOffset,
  getVerticalOffset,
  saveVerticalOffset,
  resetConfig,
  getConfigPath
};
