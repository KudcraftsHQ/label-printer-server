/**
 * Windows-specific printer implementation using native Windows printing API
 * Uses the 'printer' package for Windows spooler integration
 */

const { logger } = require('../utils/logger');

// Lazy load printer module - only on Windows
let printer = null;
function getPrinterModule() {
  if (!printer) {
    try {
      printer = require('@thiagoelg/node-printer');
    } catch (error) {
      logger.error('Failed to load printer module', { error: error.message });
      throw new Error('Windows printing module not available. Please install: npm install @thiagoelg/node-printer');
    }
  }
  return printer;
}

/**
 * Windows Printer Manager
 * Uses Windows spooler for raw printing (TSPL, ZPL, etc.)
 */
class WindowsPrinterManager {
  constructor() {
    this.connectedPrinter = null;
    this.printerName = null;
  }

  /**
   * List all installed Windows printers
   * @returns {Array} List of printers
   */
  listPrinters() {
    try {
      const printerModule = getPrinterModule();
      const printers = printerModule.getPrinters();

      return printers.map(p => ({
        // Use printer name as unique identifier on Windows
        vendorId: null,
        productId: null,
        name: p.name,
        manufacturer: p.driverName || 'Unknown',
        product: p.name,
        status: p.status,
        isDefault: p.isDefault || false,
        // Windows-specific fields
        portName: p.portName,
        shareName: p.shareName,
        // Flag to identify this as a Windows printer
        isWindowsPrinter: true
      }));
    } catch (error) {
      logger.error('Error listing Windows printers', { error: error.message });
      return [];
    }
  }

  /**
   * Connect to a Windows printer by name
   * @param {object} options - Connection options
   * @param {string} options.name - Windows printer name
   * @returns {boolean} Connection success
   */
  connect(options) {
    try {
      const { name } = options;

      if (!name) {
        throw new Error('Printer name is required');
      }

      const printerModule = getPrinterModule();

      // Verify printer exists
      const printers = printerModule.getPrinters();
      const found = printers.find(p => p.name === name);

      if (!found) {
        throw new Error(`Printer not found: ${name}`);
      }

      this.printerName = name;
      this.connectedPrinter = found;

      logger.info('Connected to Windows printer', { name });
      return true;
    } catch (error) {
      logger.error('Failed to connect to Windows printer', { error: error.message });
      this.disconnect();
      throw error;
    }
  }

  /**
   * Disconnect from printer
   */
  disconnect() {
    this.connectedPrinter = null;
    this.printerName = null;
    logger.info('Disconnected from Windows printer');
  }

  /**
   * Send raw TSPL commands to printer
   * @param {string} tsplCommands - TSPL commands to send
   * @returns {Promise<boolean>} Success status
   */
  async print(tsplCommands) {
    return new Promise((resolve, reject) => {
      try {
        if (!this.printerName) {
          throw new Error('Printer not connected');
        }

        const printerModule = getPrinterModule();
        const buffer = Buffer.from(tsplCommands, 'utf8');

        printerModule.printDirect({
          data: buffer,
          printer: this.printerName,
          type: 'RAW',
          success: (jobId) => {
            logger.info('Print job sent successfully', { jobId, bytes: buffer.length });
            resolve(true);
          },
          error: (error) => {
            logger.error('Print error', { error: error.message || error });
            reject(new Error(error.message || error));
          }
        });
      } catch (error) {
        logger.error('Print failed', { error: error.message });
        reject(error);
      }
    });
  }

  /**
   * Get printer status
   * @returns {object} Printer status
   */
  getStatus() {
    if (!this.printerName) {
      return {
        connected: false,
        ready: false,
        status: 'disconnected'
      };
    }

    try {
      const printerModule = getPrinterModule();
      const printerInfo = printerModule.getPrinter(this.printerName);

      // Windows printer status codes
      const statusMap = {
        0: 'ready',
        1: 'paused',
        2: 'error',
        3: 'pending_deletion',
        4: 'paper_jam',
        5: 'paper_out',
        6: 'manual_feed',
        7: 'paper_problem',
        8: 'offline',
        9: 'io_active',
        10: 'busy',
        11: 'printing'
      };

      return {
        connected: true,
        ready: printerInfo.status === 0,
        status: statusMap[printerInfo.status] || 'unknown',
        device: {
          name: this.printerName,
          driver: printerInfo.driverName
        },
        jobs: printerInfo.jobs || []
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
    return this.printerName !== null;
  }

  /**
   * Get last connected device info (for compatibility with USB manager)
   */
  get lastConnectedDevice() {
    if (this.printerName) {
      return { name: this.printerName, isWindowsPrinter: true };
    }
    return null;
  }
}

module.exports = { WindowsPrinterManager };
