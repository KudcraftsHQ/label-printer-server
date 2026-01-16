const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { logger } = require('../utils/logger');

// Platform detection
const isWindows = process.platform === 'win32';

// Lazy load USB module - only on non-Windows platforms
let usb = null;
function getUsbModule() {
  if (!usb) {
    usb = require('usb');
  }
  return usb;
}

// Import Windows printer manager
let WindowsPrinterManager = null;
if (isWindows) {
  try {
    WindowsPrinterManager = require('./windows-printer').WindowsPrinterManager;
  } catch (error) {
    logger.warn('Windows printer module not available', { error: error.message });
  }
}

// Config file path for persistent storage
function getConfigPath() {
  try {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'printer-config.json');
  } catch (e) {
    // Fallback for non-Electron environments
    return path.join(__dirname, '../../printer-config.json');
  }
}

/**
 * USB Vendor ID Database - maps vendor IDs to names
 */
const USB_VENDORS = {
  0x2109: 'VIA Labs',
  0x0471: 'Gprinter / Barcode Printer Co.',
  0x0BDA: 'Realtek',
  0x1A40: 'Terminus Technology',
  0x1203: 'TSC Auto ID',
  0x0A5F: 'Zebra Technologies',
  0x0922: 'DYMO',
  0x04F9: 'Brother',
  0x04B8: 'Seiko Epson',
  0x067B: 'Prolific',
  0x0483: 'STMicroelectronics',
  0x1FC9: 'NXP Semiconductors',
  0x0403: 'FTDI',
  0x10C4: 'Silicon Labs',
  0x1A86: 'QinHeng Electronics',
  0x05AC: 'Apple',
  0x8087: 'Intel',
  0x0951: 'Kingston',
  0x0781: 'SanDisk',
  0x04E8: 'Samsung',
  0x046D: 'Logitech',
  0x045E: 'Microsoft',
  0x413C: 'Dell',
  0x17EF: 'Lenovo',
  0x1D6B: 'Linux Foundation',
  0x0B95: 'ASIX Electronics',
  0x2357: 'TP-Link',
  0x148F: 'Ralink',
  0x0CF3: 'Qualcomm Atheros',
};

/**
 * USB Product ID Database - maps vendor:product to names
 */
const USB_PRODUCTS = {
  // TSC Printers
  '0x1203:0x0001': 'TTP-244 Plus',
  '0x1203:0x0002': 'TTP-245C',
  '0x1203:0x0003': 'TTP-343C',
  '0x1203:0x0004': 'TDP-225',
  '0x1203:0x0005': 'TDP-245 Plus',
  '0x1203:0x0006': 'TE200',
  '0x1203:0x0007': 'TE210',
  '0x1203:0x0064': 'TE244',
  '0x1203:0x0065': 'DA210',
  // Zebra Printers
  '0x0A5F:0x0009': 'ZD410',
  '0x0A5F:0x008B': 'ZD420',
  '0x0A5F:0x00D1': 'ZD620',
  // DYMO
  '0x0922:0x0020': 'LabelWriter 450',
  '0x0922:0x0021': 'LabelWriter 450 Turbo',
  '0x0922:0x1001': 'LabelManager PnP',
  // Brother
  '0x04F9:0x2042': 'QL-700',
  '0x04F9:0x2043': 'QL-710W',
  '0x04F9:0x2044': 'QL-720NW',
  // Common devices
  '0x2109:0x8888': 'USB Hub',
  '0x2109:0x2817': 'USB Hub',
  '0x2109:0x0817': 'USB Hub',
  '0x1A40:0x0801': 'USB 2.0 Hub',
  '0x0BDA:0x8152': 'RTL8152 USB Ethernet',
  '0x0BDA:0x8153': 'RTL8153 USB Ethernet',
  '0x0471:0x0055': 'Gprinter S-4211 (TSPL)',
};

/**
 * Device type hints based on vendor
 */
const DEVICE_TYPE_HINTS = {
  0x1203: 'Label Printer',
  0x0A5F: 'Label Printer',
  0x0922: 'Label Printer',
  0x0471: 'Label Printer',  // Gprinter uses Philips VID
  0x04F9: 'Printer',
  0x04B8: 'Printer',
  0x2109: 'USB Hub',
  0x1A40: 'USB Hub',
  0x0BDA: 'Network Adapter',
  0x05AC: 'Apple Device',
  0x046D: 'Input Device',
  0x045E: 'Input Device',
};

/**
 * Look up vendor name from USB ID database
 */
function getVendorName(vendorId) {
  return USB_VENDORS[vendorId] || null;
}

/**
 * Look up product name from USB ID database
 */
function getProductName(vendorId, productId) {
  const key = `0x${vendorId.toString(16).toUpperCase().padStart(4, '0')}:0x${productId.toString(16).toUpperCase().padStart(4, '0')}`;
  return USB_PRODUCTS[key] || DEVICE_TYPE_HINTS[vendorId] || null;
}

/**
 * Printer Manager for USB communication with TSPL printers
 */
class PrinterManager {
  constructor() {
    this.printer = null;
    this.device = null;
    this.interface = null;
    this.endpoint = null;
    this.lastConnectedDevice = null; // Store for reconnection
    this.loadSavedPrinter(); // Load saved printer on init
  }

  /**
   * Save last connected printer to disk
   */
  savePrinterConfig() {
    if (!this.lastConnectedDevice) return;

    try {
      const configPath = getConfigPath();
      fs.writeFileSync(configPath, JSON.stringify(this.lastConnectedDevice, null, 2));
      logger.info('Saved printer config', { path: configPath });
    } catch (error) {
      logger.warn('Could not save printer config', { error: error.message });
    }
  }

  /**
   * Load saved printer from disk
   */
  loadSavedPrinter() {
    try {
      const configPath = getConfigPath();
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf8');
        this.lastConnectedDevice = JSON.parse(data);
        logger.info('Loaded saved printer config', this.lastConnectedDevice);
      }
    } catch (error) {
      logger.warn('Could not load printer config', { error: error.message });
    }
  }

  /**
   * Try to auto-connect to saved printer if available
   * @returns {boolean} Success status
   */
  autoConnect() {
    if (!this.lastConnectedDevice) {
      logger.info('No saved printer to auto-connect');
      return false;
    }

    const { vendorId, productId } = this.lastConnectedDevice;

    // Check if the device is available
    const devices = this.listPrinters();
    const found = devices.find(d => d.vendorId === vendorId && d.productId === productId);

    if (!found) {
      logger.info('Saved printer not found in available devices', { vendorId, productId });
      return false;
    }

    try {
      logger.info('Auto-connecting to saved printer...', { vendorId, productId });
      this.connect({ vendorId, productId });
      return true;
    } catch (error) {
      logger.error('Auto-connect failed', { error: error.message });
      return false;
    }
  }

  /**
   * List all available USB printers
   * @returns {Array} List of USB devices
   */
  listPrinters() {
    try {
      const usbModule = getUsbModule();
      const devices = usbModule.getDeviceList();
      const printers = devices.map(device => {
        const vendorId = device.deviceDescriptor.idVendor;
        const productId = device.deviceDescriptor.idProduct;
        let manufacturer = null;
        let product = null;

        try {
          device.open();
          manufacturer = device.manufacturerName;
          product = device.productName;
          device.close();
        } catch (error) {
          logger.warn('Could not read device info', { error: error.message });
        }

        // Fall back to database lookup if device didn't provide names
        if (!manufacturer || manufacturer === 'Unknown') {
          manufacturer = getVendorName(vendorId);
        }
        if (!product || product === 'Unknown') {
          product = getProductName(vendorId, productId);
        }

        return {
          vendorId,
          productId,
          manufacturer: manufacturer || 'Unknown Vendor',
          product: product || 'Unknown Device',
          deviceAddress: device.deviceAddress,
          busNumber: device.busNumber
        };
      });

      logger.info('Found USB devices', { count: printers.length });
      return printers;
    } catch (error) {
      logger.error('Error listing printers', { error: error.message });
      return [];
    }
  }

  /**
   * Connect to a USB printer
   * @param {object} options - Connection options
   * @param {number} options.vendorId - USB Vendor ID
   * @param {number} options.productId - USB Product ID
   * @returns {boolean} Connection success
   */
  connect(options) {
    try {
      const { vendorId, productId } = options;

      if (!vendorId || !productId) {
        throw new Error('vendorId and productId are required');
      }

      // Find device
      const usbModule = getUsbModule();
      this.device = usbModule.findByIds(vendorId, productId);
      if (!this.device) {
        throw new Error(`Printer not found: ${vendorId}:${productId}`);
      }

      // Open device
      this.device.open();

      // Get first interface
      this.interface = this.device.interface(0);

      // Detach kernel driver if active (Linux only)
      if (this.interface.isKernelDriverActive()) {
        try {
          this.interface.detachKernelDriver();
        } catch (error) {
          logger.warn('Could not detach kernel driver', { error: error.message });
        }
      }

      // Claim interface
      this.interface.claim();

      // Find OUT endpoint
      this.endpoint = this.interface.endpoints.find(
        ep => ep.direction === 'out'
      );

      if (!this.endpoint) {
        throw new Error('No OUT endpoint found');
      }

      // Store connection info for auto-reconnect and save to disk
      this.lastConnectedDevice = { vendorId, productId };
      this.savePrinterConfig();

      logger.info('Connected to printer', { vendorId, productId });
      return true;
    } catch (error) {
      logger.error('Failed to connect to printer', { error: error.message });
      this.disconnect();
      throw error;
    }
  }

  /**
   * Disconnect from printer
   */
  disconnect() {
    try {
      if (this.interface) {
        try {
          this.interface.release(true, (error) => {
            if (error) {
              logger.warn('Error releasing interface', { error: error.message });
            }
          });
        } catch (error) {
          logger.warn('Error releasing interface', { error: error.message });
        }
      }

      if (this.device) {
        try {
          this.device.close();
        } catch (error) {
          logger.warn('Error closing device', { error: error.message });
        }
      }

      this.printer = null;
      this.device = null;
      this.interface = null;
      this.endpoint = null;

      logger.info('Disconnected from printer');
    } catch (error) {
      logger.error('Error disconnecting from printer', { error: error.message });
    }
  }

  /**
   * Attempt to reconnect to last known printer
   * @returns {boolean} Success status
   */
  tryReconnect() {
    if (!this.lastConnectedDevice) {
      return false;
    }

    try {
      logger.info('Attempting to reconnect to printer...');
      // Clean up old connection
      this.device = null;
      this.interface = null;
      this.endpoint = null;

      // Try to reconnect
      this.connect(this.lastConnectedDevice);
      return true;
    } catch (error) {
      logger.error('Reconnect failed', { error: error.message });
      return false;
    }
  }

  /**
   * Send TSPL commands to printer
   * @param {string} tsplCommands - TSPL commands to send
   * @returns {Promise<boolean>} Success status
   */
  async print(tsplCommands) {
    return new Promise((resolve, reject) => {
      const attemptPrint = (isRetry = false) => {
        try {
          if (!this.endpoint || !this.device) {
            // Try to reconnect if we have previous connection info
            if (!isRetry && this.lastConnectedDevice) {
              logger.info('Device not connected, attempting reconnect...');
              if (this.tryReconnect()) {
                attemptPrint(true);
                return;
              }
            }
            throw new Error('Printer not connected');
          }

          const buffer = Buffer.from(tsplCommands, 'utf8');

          this.endpoint.transfer(buffer, (error) => {
            if (error) {
              logger.error('Print error', { error: error.message });

              // If transfer fails due to device not open, try reconnect once
              if (!isRetry && (error.message.includes('not open') || error.message.includes('LIBUSB'))) {
                logger.info('Device connection lost, attempting reconnect...');
                this.device = null;
                this.interface = null;
                this.endpoint = null;

                if (this.tryReconnect()) {
                  attemptPrint(true);
                  return;
                }
              }
              reject(error);
            } else {
              logger.info('Print job sent successfully', { bytes: buffer.length });
              resolve(true);
            }
          });
        } catch (error) {
          logger.error('Print failed', { error: error.message });
          reject(error);
        }
      };

      attemptPrint();
    });
  }

  /**
   * Get printer status
   * @returns {object} Printer status
   */
  getStatus() {
    if (!this.device) {
      return {
        connected: false,
        ready: false,
        status: 'disconnected'
      };
    }

    try {
      // Basic status - in a real implementation, you would query the printer
      return {
        connected: true,
        ready: true,
        status: 'ready',
        device: {
          vendorId: this.device.deviceDescriptor.idVendor,
          productId: this.device.deviceDescriptor.idProduct
        }
      };
    } catch (error) {
      logger.error('Error getting printer status', { error: error.message });
      return {
        connected: false,
        ready: false,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Check if printer is connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.device !== null && this.endpoint !== null;
  }
}

// Singleton instance
let printerManagerInstance = null;

/**
 * Get printer manager instance
 * Returns WindowsPrinterManager on Windows, PrinterManager (USB) on other platforms
 * @returns {PrinterManager|WindowsPrinterManager} Printer manager singleton
 */
function getPrinterManager() {
  if (!printerManagerInstance) {
    if (isWindows && WindowsPrinterManager) {
      logger.info('Using Windows native printer manager');
      printerManagerInstance = new WindowsPrinterManager();
    } else {
      logger.info('Using USB printer manager');
      printerManagerInstance = new PrinterManager();
    }
  }
  return printerManagerInstance;
}

module.exports = { PrinterManager, getPrinterManager, isWindows };
