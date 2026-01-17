/**
 * Page configurations for different label layouts
 * All measurements are in millimeters and will be converted to inches for TSPL
 */

const PAGE_CONFIGS = {
  // Default: 3 stickers per row, 33mm x 15mm each
  default: {
    name: 'Default (3x33mm)',
    sticker: {
      width: 33,      // mm
      height: 15,     // mm
    },
    layout: {
      columns: 3,     // 3 stickers per row
      gap: 3,         // mm - gap between stickers
      outerMargin: 1.5 // mm - margin from edge
    },
    // Calculated values
    get pageWidth() {
      return (this.sticker.width * this.layout.columns) +
             (this.layout.gap * (this.layout.columns - 1)) +
             (this.layout.outerMargin * 2);
    },
    get pageHeight() {
      return this.sticker.height + (this.layout.outerMargin * 2);
    }
  },

  // 2 stickers per row, 50mm x 20mm each
  double_50x20: {
    name: 'Double (2x50mm)',
    sticker: {
      width: 50,
      height: 20,
    },
    layout: {
      columns: 2,
      gap: 3,
      outerMargin: 1.5
    },
    get pageWidth() {
      return (this.sticker.width * this.layout.columns) +
             (this.layout.gap * (this.layout.columns - 1)) +
             (this.layout.outerMargin * 2);
    },
    get pageHeight() {
      return this.sticker.height + (this.layout.outerMargin * 2);
    }
  }
};

/**
 * Convert millimeters to inches
 * @param {number} mm - Value in millimeters
 * @returns {number} Value in inches
 */
function mmToInches(mm) {
  return (mm / 25.4).toFixed(2);
}

/**
 * Get page config by ID
 * @param {string} configId - Config ID (default, single_large, etc.)
 * @returns {object} Page configuration
 */
function getPageConfig(configId = 'default') {
  const config = PAGE_CONFIGS[configId];
  if (!config) {
    throw new Error(`Page config '${configId}' not found`);
  }
  return config;
}

/**
 * Get all available page configs
 * @returns {object} All page configurations
 */
function getAllPageConfigs() {
  return PAGE_CONFIGS;
}

module.exports = {
  PAGE_CONFIGS,
  mmToInches,
  getPageConfig,
  getAllPageConfigs
};
