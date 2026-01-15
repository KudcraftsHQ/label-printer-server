const usb = require('usb');
const { logger } = require('../utils/logger');

/**
 * Printer Manager for USB communication with TSPL printers
 */
class PrinterManager {
  constructor() {
    this.printer = null;
    this.device = null;
    this.interface = null;
    this.endpoint = null;
  }

  /**
   * List all available USB printers
   * @returns {Array} List of USB devices
   */
  listPrinters() {
    try {
      const devices = usb.getDeviceList();
      const printers = devices.map(device => {
        try {
          device.open();
          const descriptor = device.deviceDescriptor;
          const manufacturer = device.manufacturerName || 'Unknown';
          const product = device.productName || 'Unknown';
          device.close();

          return {
            vendorId: descriptor.idVendor,
            productId: descriptor.idProduct,
            manufacturer,
            product,
            deviceAddress: device.deviceAddress,
            busNumber: device.busNumber
          };
        } catch (error) {
          logger.warn('Could not read device info', { error: error.message });
          return {
            vendorId: device.deviceDescriptor.idVendor,
            productId: device.deviceDescriptor.idProduct,
            manufacturer: 'Unknown',
            product: 'Unknown',
            deviceAddress: device.deviceAddress,
            busNumber: device.busNumber
          };
        }
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
      this.device = usb.findByIds(vendorId, productId);
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
   * Send TSPL commands to printer
   * @param {string} tsplCommands - TSPL commands to send
   * @returns {Promise<boolean>} Success status
   */
  async print(tsplCommands) {
    return new Promise((resolve, reject) => {
      try {
        if (!this.endpoint) {
          throw new Error('Printer not connected');
        }

        const buffer = Buffer.from(tsplCommands, 'utf8');

        this.endpoint.transfer(buffer, (error) => {
          if (error) {
            logger.error('Print error', { error: error.message });
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
 * @returns {PrinterManager} Printer manager singleton
 */
function getPrinterManager() {
  if (!printerManagerInstance) {
    printerManagerInstance = new PrinterManager();
  }
  return printerManagerInstance;
}

module.exports = { PrinterManager, getPrinterManager };
