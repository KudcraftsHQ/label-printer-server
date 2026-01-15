const { getPageConfig, mmToInches } = require('../config/page-configs');
const { logger } = require('../utils/logger');

/**
 * Generates TSPL commands for printing labels
 */
class TSPLGenerator {
  constructor(pageConfigId = 'default') {
    this.pageConfig = getPageConfig(pageConfigId);
    this.commands = [];
  }

  /**
   * Initialize label with size and gap settings
   * @returns {TSPLGenerator} this for chaining
   */
  initLabel() {
    const { sticker, layout } = this.pageConfig;

    // SIZE command: width, height in inches
    const width = mmToInches(sticker.width);
    const height = mmToInches(sticker.height);
    this.commands.push(`SIZE ${width},${height}`);

    // GAP command: gap between labels, offset in inches
    const gap = mmToInches(layout.gap);
    this.commands.push(`GAP ${gap},0`);

    // Set print direction (0 = no rotation)
    this.commands.push('DIRECTION 0');

    // Clear label buffer
    this.commands.push('CLS');

    return this;
  }

  /**
   * Add QR code to label
   * @param {object} options - QR code options
   * @param {number} options.x - X position in mm
   * @param {number} options.y - Y position in mm
   * @param {string} options.data - Data to encode
   * @param {string} options.eccLevel - Error correction level (L, M, Q, H)
   * @param {number} options.cellWidth - Cell width (1-10)
   * @param {number} options.rotation - Rotation angle (0, 90, 180, 270)
   * @returns {TSPLGenerator} this for chaining
   */
  addQRCode(options) {
    const {
      x = 10,
      y = 10,
      data,
      eccLevel = 'H',
      cellWidth = 4,
      rotation = 0
    } = options;

    if (!data) {
      throw new Error('QR code data is required');
    }

    // Convert mm to dots (assuming 203 DPI: 8 dots per mm)
    const xDots = Math.round(x * 8);
    const yDots = Math.round(y * 8);

    // QRCODE syntax: x,y,ECC level,cell width,mode,rotation,"data"
    // Mode: A = Auto
    const cmd = `QRCODE ${xDots},${yDots},${eccLevel},${cellWidth},A,${rotation},"${data}"`;
    this.commands.push(cmd);

    logger.debug('Added QR code', { x, y, data, eccLevel, cellWidth, rotation });

    return this;
  }

  /**
   * Add text to label
   * @param {object} options - Text options
   * @param {number} options.x - X position in mm
   * @param {number} options.y - Y position in mm
   * @param {string} options.text - Text to print
   * @param {string} options.font - Font (1-8, or TSS24.BF2, TSS32.BF2, etc.)
   * @param {number} options.rotation - Rotation angle (0, 90, 180, 270)
   * @param {number} options.xMul - X multiplication factor (1-10)
   * @param {number} options.yMul - Y multiplication factor (1-10)
   * @returns {TSPLGenerator} this for chaining
   */
  addText(options) {
    const {
      x = 0,
      y = 0,
      text,
      font = '3',
      rotation = 0,
      xMul = 1,
      yMul = 1
    } = options;

    if (!text) {
      throw new Error('Text is required');
    }

    // Convert mm to dots (assuming 203 DPI: 8 dots per mm)
    const xDots = Math.round(x * 8);
    const yDots = Math.round(y * 8);

    // TEXT syntax: x,y,"font",rotation,x-mul,y-mul,"text"
    const cmd = `TEXT ${xDots},${yDots},"${font}",${rotation},${xMul},${yMul},"${text}"`;
    this.commands.push(cmd);

    logger.debug('Added text', { x, y, text, font });

    return this;
  }

  /**
   * Add a line/box to the label
   * @param {object} options - Box options
   * @param {number} options.x - X position in mm
   * @param {number} options.y - Y position in mm
   * @param {number} options.width - Width in mm
   * @param {number} options.height - Height in mm
   * @param {number} options.thickness - Line thickness in dots
   * @returns {TSPLGenerator} this for chaining
   */
  addBox(options) {
    const {
      x = 0,
      y = 0,
      width,
      height,
      thickness = 2
    } = options;

    // Convert mm to dots
    const xDots = Math.round(x * 8);
    const yDots = Math.round(y * 8);
    const xEndDots = Math.round((x + width) * 8);
    const yEndDots = Math.round((y + height) * 8);

    // BOX syntax: x_start,y_start,x_end,y_end,line_thickness
    const cmd = `BOX ${xDots},${yDots},${xEndDots},${yEndDots},${thickness}`;
    this.commands.push(cmd);

    return this;
  }

  /**
   * Set print quantity
   * @param {number} quantity - Number of labels to print
   * @param {number} copies - Number of copies of each label (default 1)
   * @returns {TSPLGenerator} this for chaining
   */
  print(quantity = 1, copies = 1) {
    // PRINT quantity,copies
    this.commands.push(`PRINT ${quantity},${copies}`);
    return this;
  }

  /**
   * Generate a label with QR code and text (like the example image)
   * @param {object} data - Label data
   * @param {string} data.qrData - Data for QR code
   * @param {string} data.title - Title text
   * @param {string} data.subtitle - Subtitle text
   * @param {number} data.quantity - Number of labels to print
   * @returns {string} TSPL commands
   */
  generateProductLabel(data) {
    const { qrData, title, subtitle, quantity = 1 } = data;

    if (!qrData || !title) {
      throw new Error('qrData and title are required');
    }

    this.initLabel();

    // Add QR code on the left (10mm from left, 2mm from top)
    this.addQRCode({
      x: 2,
      y: 2,
      data: qrData,
      eccLevel: 'H',
      cellWidth: 3,
      rotation: 0
    });

    // Add title text (after QR code, centered vertically)
    this.addText({
      x: 14,
      y: 2,
      text: title,
      font: '3',
      xMul: 1,
      yMul: 1
    });

    // Add subtitle if provided
    if (subtitle) {
      this.addText({
        x: 14,
        y: 8,
        text: subtitle,
        font: '3',
        xMul: 1,
        yMul: 1
      });
    }

    this.print(quantity);

    return this.getTSPL();
  }

  /**
   * Get the complete TSPL command string
   * @returns {string} TSPL commands joined with \r\n
   */
  getTSPL() {
    const tspl = this.commands.join('\r\n') + '\r\n';
    logger.debug('Generated TSPL', { commandCount: this.commands.length });
    return tspl;
  }

  /**
   * Reset the command buffer
   * @returns {TSPLGenerator} this for chaining
   */
  reset() {
    this.commands = [];
    return this;
  }
}

module.exports = { TSPLGenerator };
