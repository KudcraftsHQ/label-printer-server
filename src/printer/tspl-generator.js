const { getPageConfig, mmToInches } = require('../config/page-configs');
const { logger } = require('../utils/logger');

/**
 * Layout constants
 */
const LAYOUT_CONFIG = {
  PADDING: 2,           // Internal padding in mm
  MIN_FONT_SIZE: 1,     // Minimum font (1 = 8x12 dots)
  MAX_FONT_SIZE: 4,     // Maximum font (4 = 24x32 dots)
  DPI: 8,               // Dots per mm (203 DPI ≈ 8 dots/mm)
  // Font dimensions in dots (width x height)
  FONTS: {
    1: { width: 8, height: 12, name: 'tiny' },
    2: { width: 12, height: 20, name: 'small' },
    3: { width: 16, height: 24, name: 'medium' },
    4: { width: 24, height: 32, name: 'large' }
  },
  // QR layout character limits (for 33x15mm sticker with 17mm text width)
  // These ensure text is never clipped when wrapped
  QR_LAYOUT_LIMITS: {
    // With quantity: title 2 lines, subtitle 1 line, qty 1 line
    TITLE_MAX_CHARS: 22,              // Font 2, 11 chars/line × 2 lines
    SUBTITLE_MAX_CHARS_WITH_QTY: 17,  // Font 1, 17 chars/line × 1 line
    // Without quantity: title 2 lines, subtitle 2 lines
    SUBTITLE_MAX_CHARS: 34,           // Font 1, 17 chars/line × 2 lines
    QUANTITY_MAX_CHARS: 17            // Font 1, 17 chars/line × 1 line
  }
};

/**
 * Generates TSPL commands for printing labels
 */
class TSPLGenerator {
  constructor(pageConfigId = 'default') {
    this.pageConfig = getPageConfig(pageConfigId);
    this.commands = [];
    this.padding = LAYOUT_CONFIG.PADDING;
    this.fullRowMode = false; // Track if using full row width (multi-column)
  }

  /**
   * Initialize label with size and gap settings
   * @param {boolean} fullRow - If true, use full row width for multi-column labels
   * @returns {TSPLGenerator} this for chaining
   */
  initLabel(fullRow = false) {
    const { sticker, layout } = this.pageConfig;

    // Track mode for coordinate calculations
    this.fullRowMode = fullRow && layout.columns > 1;

    // For multi-column layouts, use full row width including outer margins
    let width, height;
    if (this.fullRowMode) {
      // Full row width: (sticker * columns) + (gap * (columns-1)) + (margin * 2)
      const rowWidth = (sticker.width * layout.columns) +
                       (layout.gap * (layout.columns - 1)) +
                       (layout.outerMargin * 2);
      width = mmToInches(rowWidth);
      height = mmToInches(sticker.height);
    } else {
      width = mmToInches(sticker.width);
      height = mmToInches(sticker.height);
    }

    this.commands.push(`SIZE ${width},${height}`);

    // GAP command: gap between rows, offset in inches
    const gap = mmToInches(layout.gap);
    this.commands.push(`GAP ${gap},0`);

    // Set print direction (1 = 180 degree rotation for correct orientation)
    this.commands.push('DIRECTION 1');

    // Clear label buffer
    this.commands.push('CLS');

    return this;
  }

  /**
   * Get X offset for a specific column (0-indexed from left)
   * Using DIRECTION 1, so normal coordinates (x=0 on left)
   * @param {number} column - Column index (0, 1, 2, ... from left)
   * @returns {number} X offset in mm
   */
  getColumnOffset(column) {
    // In single-sticker mode, SIZE is set to sticker dimensions
    // so coordinates are relative to sticker (no outer margin needed)
    if (!this.fullRowMode) {
      return 0;
    }

    // In full row mode, SIZE includes outer margins
    // so we need to offset by outerMargin for column 0
    const { sticker, layout } = this.pageConfig;
    return layout.outerMargin + (column * (sticker.width + layout.gap));
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
   * Add barcode to label (CODE128)
   * @param {object} options - Barcode options
   * @param {number} options.x - X position in mm
   * @param {number} options.y - Y position in mm
   * @param {string} options.data - Data to encode
   * @param {number} options.height - Barcode height in mm
   * @param {number} options.narrow - Narrow bar width (1-10, default 2)
   * @param {number} options.rotation - Rotation (0, 90, 180, 270)
   * @param {boolean} options.showText - Show human readable text below barcode
   * @returns {TSPLGenerator} this for chaining
   */
  addBarcode(options) {
    const {
      x = 0,
      y = 0,
      data,
      height = 10,
      narrow = 2,
      rotation = 0,
      showText = true
    } = options;

    if (!data) {
      throw new Error('Barcode data is required');
    }

    // Convert mm to dots
    const xDots = Math.round(x * 8);
    const yDots = Math.round(y * 8);
    const heightDots = Math.round(height * 8);
    const readable = showText ? 1 : 0;

    // BARCODE syntax: x,y,"code type",height,readable,rotation,narrow,wide,"data"
    // Using CODE128 which is versatile and common
    const wide = narrow * 2;
    const cmd = `BARCODE ${xDots},${yDots},"128",${heightDots},${readable},${rotation},${narrow},${wide},"${data}"`;
    this.commands.push(cmd);

    logger.debug('Added barcode', { x, y, data, height });

    return this;
  }

  /**
   * Calculate the best font size for text to fit within available width
   * @param {string} text - Text to measure
   * @param {number} availableWidthMm - Available width in mm
   * @param {number} maxFont - Maximum font size to use (1-4)
   * @returns {object} Font settings { font, fits, maxChars }
   */
  calculateFontForWidth(text, availableWidthMm, maxFont = LAYOUT_CONFIG.MAX_FONT_SIZE) {
    const availableDots = availableWidthMm * LAYOUT_CONFIG.DPI;
    const textLength = text.length;

    // Try each font from largest to smallest
    for (let fontNum = Math.min(maxFont, LAYOUT_CONFIG.MAX_FONT_SIZE); fontNum >= LAYOUT_CONFIG.MIN_FONT_SIZE; fontNum--) {
      const font = LAYOUT_CONFIG.FONTS[fontNum];
      const textWidthDots = font.width * textLength;
      const maxChars = Math.floor(availableDots / font.width);

      if (textWidthDots <= availableDots) {
        return { font: String(fontNum), fits: true, maxChars, height: font.height };
      }
    }

    // Text doesn't fit even with smallest font - return smallest font info
    const smallestFont = LAYOUT_CONFIG.FONTS[LAYOUT_CONFIG.MIN_FONT_SIZE];
    const maxChars = Math.floor(availableDots / smallestFont.width);
    return { font: String(LAYOUT_CONFIG.MIN_FONT_SIZE), fits: false, maxChars, height: smallestFont.height };
  }

  /**
   * Calculate font height in mm
   * @param {number} fontNum - Font number (1-4)
   * @returns {number} Height in mm
   */
  getFontHeightMm(fontNum) {
    const font = LAYOUT_CONFIG.FONTS[fontNum] || LAYOUT_CONFIG.FONTS[1];
    return font.height / LAYOUT_CONFIG.DPI;
  }

  /**
   * Truncate text to fit within available characters, adding ellipsis if needed
   * @param {string} text - Text to truncate
   * @param {number} maxChars - Maximum characters allowed
   * @returns {string} Truncated text
   */
  truncateText(text, maxChars) {
    if (!text || maxChars <= 0) return '';
    if (text.length <= maxChars) return text;
    if (maxChars <= 2) return text.substring(0, maxChars);
    return text.substring(0, maxChars - 2) + '..';
  }

  /**
   * Calculate layout dimensions for a sticker with padding
   * @returns {object} Layout dimensions
   */
  getStickerLayout() {
    const { sticker } = this.pageConfig;
    const padding = this.padding;

    return {
      width: sticker.width,
      height: sticker.height,
      innerWidth: sticker.width - (padding * 2),
      innerHeight: sticker.height - (padding * 2),
      padding: padding,
      paddingDots: padding * LAYOUT_CONFIG.DPI
    };
  }

  /**
   * Calculate max characters that fit in a given width for a font
   * @param {number} widthMm - Available width in mm
   * @param {number} fontNum - Font number (1-4)
   * @returns {number} Max characters
   */
  getMaxCharsForWidth(widthMm, fontNum) {
    const font = LAYOUT_CONFIG.FONTS[fontNum] || LAYOUT_CONFIG.FONTS[1];
    return Math.floor((widthMm * LAYOUT_CONFIG.DPI) / font.width);
  }

  /**
   * Wrap text to fit within available width
   * @param {string} text - Text to wrap
   * @param {number} maxWidthMm - Maximum width in mm
   * @param {number} fontNum - Font number (1-4)
   * @param {number} maxLines - Maximum number of lines allowed
   * @returns {string[]} Array of lines (guaranteed to fit)
   */
  wrapText(text, maxWidthMm, fontNum, maxLines = 2) {
    if (!text) return [];

    const charsPerLine = this.getMaxCharsForWidth(maxWidthMm, fontNum);
    if (charsPerLine <= 0) return [];

    // Split by spaces, but also handle hyphenated words
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (let wordIdx = 0; wordIdx < words.length; wordIdx++) {
      let word = words[wordIdx];

      // Process the word (may need multiple iterations for long words)
      while (word.length > 0 && lines.length < maxLines) {
        const testLine = currentLine ? currentLine + ' ' + word : word;

        if (testLine.length <= charsPerLine) {
          // Word fits on current line
          currentLine = testLine;
          break; // Move to next word
        } else {
          // Word doesn't fit
          if (currentLine) {
            // Save current line and start new one
            lines.push(currentLine);
            currentLine = '';
            if (lines.length >= maxLines) break;
            // Don't consume word yet, retry on new line
            continue;
          }

          // Current line is empty, word is too long - hard wrap it
          if (word.length > charsPerLine) {
            // Check if we can break at a hyphen within the line width
            let breakPoint = charsPerLine;
            for (let i = charsPerLine - 1; i > 0; i--) {
              if (word[i] === '-') {
                breakPoint = i + 1; // Include the hyphen
                break;
              }
            }

            // Take what fits on this line
            currentLine = word.substring(0, breakPoint);
            word = word.substring(breakPoint);

            // If no more lines available, we're done with this word
            if (lines.length >= maxLines - 1) {
              break;
            }

            // Save line and continue with remainder
            lines.push(currentLine);
            currentLine = '';
            if (lines.length >= maxLines) break;
          } else {
            // Word fits on a line by itself
            currentLine = word;
            break;
          }
        }
      }

      if (lines.length >= maxLines) break;
    }

    // Add remaining content
    if (currentLine && lines.length < maxLines) {
      lines.push(currentLine);
    }

    // Final safety check - ensure no line exceeds width
    return lines.map(line => {
      if (line.length > charsPerLine) {
        return line.substring(0, charsPerLine);
      }
      return line;
    });
  }

  /**
   * Calculate how many lines of text can fit in available height
   * @param {number} availableHeightMm - Available height in mm
   * @param {number} fontNum - Font number (1-4)
   * @param {number} lineSpacingMm - Spacing between lines
   * @returns {number} Maximum lines that fit
   */
  getMaxLinesForHeight(availableHeightMm, fontNum, lineSpacingMm = 0.5) {
    const fontHeightMm = this.getFontHeightMm(fontNum);
    if (fontHeightMm <= 0) return 0;
    return Math.floor((availableHeightMm + lineSpacingMm) / (fontHeightMm + lineSpacingMm));
  }

  /**
   * Calculate barcode width in dots for CODE128
   * @param {string} data - Barcode data
   * @param {number} narrow - Narrow bar width in dots
   * @returns {number} Estimated barcode width in dots
   */
  getBarcodeWidthDots(data, narrow) {
    // CODE128 structure (quiet zones handled separately by printer):
    // - Start code: 11 modules
    // - Data: 11 modules per character
    // - Check digit: 11 modules
    // - Stop pattern: 13 modules
    // Total = 11 + (11 * length) + 11 + 13 = 35 + 11 * length
    //
    // Each module = narrow width in dots
    const dataModules = 11 * data.length;
    const overheadModules = 11 + 11 + 13; // start + checksum + stop
    const totalModules = dataModules + overheadModules;

    return totalModules * narrow;
  }

  /**
   * Calculate barcode parameters to fit within width, or return null if can't fit
   * @param {string} data - Barcode data
   * @param {number} maxWidthMm - Maximum width in mm
   * @returns {object|null} { narrow, truncatedData, widthMm } or null if can't fit at all
   */
  calculateBarcodeParams(data, maxWidthMm) {
    if (!data) return null;

    const maxWidthDots = maxWidthMm * LAYOUT_CONFIG.DPI;

    // Try with original data, decreasing narrow width
    for (let narrow = 2; narrow >= 1; narrow--) {
      const barcodeWidth = this.getBarcodeWidthDots(data, narrow);
      // Reserve space for quiet zones (10 modules each side)
      const quietZoneDots = 10 * narrow * 2;
      const totalWidth = barcodeWidth + quietZoneDots;

      if (totalWidth <= maxWidthDots) {
        return {
          narrow,
          truncatedData: data,
          fits: true,
          widthMm: barcodeWidth / LAYOUT_CONFIG.DPI,
          quietZoneMm: (quietZoneDots / 2) / LAYOUT_CONFIG.DPI // per side
        };
      }
    }

    // Try truncating the data (only if necessary)
    for (let len = data.length - 1; len >= 4; len--) {
      const truncated = data.substring(0, len);
      const barcodeWidth = this.getBarcodeWidthDots(truncated, 1);
      const quietZoneDots = 10 * 1 * 2;
      const totalWidth = barcodeWidth + quietZoneDots;

      if (totalWidth <= maxWidthDots) {
        return {
          narrow: 1,
          truncatedData: truncated,
          fits: true,
          widthMm: barcodeWidth / LAYOUT_CONFIG.DPI,
          quietZoneMm: (quietZoneDots / 2) / LAYOUT_CONFIG.DPI
        };
      }
    }

    // Can't fit even minimum barcode
    return null;
  }

  /**
   * Find the best font size that fits text in available width
   * @param {string} text - Text to fit
   * @param {number} maxWidthMm - Maximum width in mm
   * @param {number} maxFont - Maximum font to try (default 3)
   * @returns {number} Best font number
   */
  findBestFont(text, maxWidthMm, maxFont = 3) {
    for (let fontNum = maxFont; fontNum >= LAYOUT_CONFIG.MIN_FONT_SIZE; fontNum--) {
      const maxChars = this.getMaxCharsForWidth(maxWidthMm, fontNum);
      if (text.length <= maxChars) {
        return fontNum;
      }
    }
    return LAYOUT_CONFIG.MIN_FONT_SIZE;
  }

  /**
   * Calculate text width in mm for a given text and font
   * @param {string} text - Text to measure
   * @param {number} fontNum - Font number (1-4)
   * @returns {number} Text width in mm
   */
  getTextWidthMm(text, fontNum) {
    if (!text) return 0;
    const font = LAYOUT_CONFIG.FONTS[fontNum] || LAYOUT_CONFIG.FONTS[1];
    return (font.width * text.length) / LAYOUT_CONFIG.DPI;
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
   * Add content to a single sticker at specified column
   * @param {object} data - Label data
   * @param {number} column - Column index (0-indexed)
   * @private
   */
  _addStickerContent(data, column = 0) {
    const { title, subtitle, codeData, layoutType, itemQuantity } = data;
    const layout = this.getStickerLayout();
    const colOffset = this.getColumnOffset(column);

    // Content area starts at padding offset
    const contentX = colOffset + layout.padding;
    const contentY = layout.padding;
    const contentWidth = layout.innerWidth;
    const contentHeight = layout.innerHeight;

    if (layoutType === 'qr' && codeData) {
      this._layoutQR(contentX, contentY, contentWidth, contentHeight, title, subtitle, codeData, itemQuantity);
    } else if (layoutType === 'text-only') {
      this._layoutTextOnly(contentX, contentY, contentWidth, contentHeight, title, subtitle);
    } else {
      this._layoutBarcode(contentX, contentY, contentWidth, contentHeight, title, subtitle, codeData);
    }
  }

  /**
   * Layout for QR code with text (QR left-aligned, text vertically distributed)
   * Supports 3 fields: title (SKU - bold), subtitle (Batch), quantity
   * Layout: SKU at top, Batch in middle, Qty at bottom
   * @private
   */
  _layoutQR(x, y, width, height, title, subtitle, qrData, quantity) {
    const qrTextGap = 1; // 1mm gap between QR and text

    // QR code: square, full inner height, left-aligned
    const qrSizeMm = height;
    const qrCellWidth = Math.max(1, Math.floor((qrSizeMm * LAYOUT_CONFIG.DPI) / 25));

    this.addQRCode({
      x: x,
      y: y,
      data: qrData,
      eccLevel: 'M',
      cellWidth: qrCellWidth,
      rotation: 0
    });

    // Text area to the right of QR
    const textX = x + qrSizeMm + qrTextGap;
    const textWidth = width - qrSizeMm - qrTextGap;

    if (textWidth < 3) {
      return;
    }

    // Font settings - SKU gets larger/bold font
    const skuFont = 2; // Larger font for SKU (bold effect)
    const skuLineHeight = this.getFontHeightMm(skuFont);
    const smallFont = 1;
    const smallLineHeight = this.getFontHeightMm(smallFont);

    const hasSubtitle = !!subtitle;
    const hasQuantity = quantity !== undefined && quantity !== null;

    // Calculate vertical positions for distributed layout
    // SKU at top, Batch in middle, Qty at bottom
    const topY = y;
    const bottomY = y + height - smallLineHeight;
    const middleY = y + (height - smallLineHeight) / 2;

    // Render SKU (title) at TOP - bold/prominent
    if (title) {
      const skuMaxChars = this.getMaxCharsForWidth(textWidth, skuFont);
      const displaySku = this.truncateText(title, skuMaxChars);
      this.addText({
        x: textX,
        y: topY,
        text: displaySku,
        font: String(skuFont),
        xMul: 1,
        yMul: 1
      });
    }

    // Render Batch (subtitle) in MIDDLE
    if (hasSubtitle) {
      const batchMaxChars = this.getMaxCharsForWidth(textWidth, smallFont);
      const displayBatch = this.truncateText(subtitle, batchMaxChars);
      this.addText({
        x: textX,
        y: middleY,
        text: displayBatch,
        font: String(smallFont),
        xMul: 1,
        yMul: 1
      });
    }

    // Render Qty at BOTTOM
    if (hasQuantity) {
      const qtyText = `Qty: ${quantity}`;
      this.addText({
        x: textX,
        y: bottomY,
        text: qtyText,
        font: String(smallFont),
        xMul: 1,
        yMul: 1
      });
    }
  }

  /**
   * Layout for text only (title + subtitle)
   * @private
   */
  _layoutTextOnly(x, y, width, height, title, subtitle) {
    let currentY = y;
    const lineSpacing = 0.5;

    // Calculate space allocation
    const hasSubtitle = !!subtitle;
    const titleMaxLines = hasSubtitle ? 2 : 3;

    // Title: find best font, wrap text
    const titleFont = this.findBestFont(title, width, 3);
    const titleLines = this.wrapText(title, width, titleFont, titleMaxLines);
    const titleLineHeight = this.getFontHeightMm(titleFont);

    for (const line of titleLines) {
      if (currentY + titleLineHeight > y + height) break;
      this.addText({ x: x, y: currentY, text: line, font: String(titleFont), xMul: 1, yMul: 1 });
      currentY += titleLineHeight + lineSpacing;
    }

    // Subtitle
    if (hasSubtitle && currentY + 1.5 <= y + height) {
      const subtitleFont = this.findBestFont(subtitle, width, 2);
      const subtitleLines = this.wrapText(subtitle, width, subtitleFont, 1);
      const subtitleLineHeight = this.getFontHeightMm(subtitleFont);

      for (const line of subtitleLines) {
        if (currentY + subtitleLineHeight > y + height) break;
        this.addText({ x: x, y: currentY, text: line, font: String(subtitleFont), xMul: 1, yMul: 1 });
        currentY += subtitleLineHeight + lineSpacing;
      }
    }
  }

  /**
   * Layout for barcode with text (stacked vertically, text centered)
   * @private
   */
  _layoutBarcode(x, y, width, height, title, subtitle, barcodeData) {
    const lineSpacing = 0.3;
    const hasBarcode = !!barcodeData;
    const hasSubtitle = !!subtitle;

    // Calculate barcode space (if barcode fits)
    let barcodeParams = null;
    let barcodeHeight = 0;

    if (hasBarcode) {
      barcodeParams = this.calculateBarcodeParams(barcodeData, width);
      if (barcodeParams) {
        barcodeHeight = Math.min(4, height * 0.35); // Max 4mm or 35% of height
      }
    }

    // Available height for text
    const textAreaHeight = height - barcodeHeight - (barcodeHeight > 0 ? 0.5 : 0);
    let currentY = y;

    // Title: find best font, wrap if needed
    const titleFont = this.findBestFont(title, width, 2);
    const titleLineHeight = this.getFontHeightMm(titleFont);
    const titleMaxLines = hasSubtitle ? 1 : 2;
    const titleLines = this.wrapText(title, width, titleFont, titleMaxLines);

    for (const line of titleLines) {
      if (currentY + titleLineHeight > y + textAreaHeight) break;
      // Center the title line
      const lineWidth = this.getTextWidthMm(line, titleFont);
      const centeredX = x + (width - lineWidth) / 2;
      this.addText({ x: centeredX, y: currentY, text: line, font: String(titleFont), xMul: 1, yMul: 1 });
      currentY += titleLineHeight + lineSpacing;
    }

    // Subtitle (single line, smaller font, centered)
    if (hasSubtitle && currentY + 1.5 <= y + textAreaHeight) {
      const subtitleFont = this.findBestFont(subtitle, width, 1);
      const maxChars = this.getMaxCharsForWidth(width, subtitleFont);
      const displaySubtitle = this.truncateText(subtitle, maxChars);
      const subtitleLineHeight = this.getFontHeightMm(subtitleFont);

      if (currentY + subtitleLineHeight <= y + textAreaHeight) {
        // Center the subtitle
        const subtitleWidth = this.getTextWidthMm(displaySubtitle, subtitleFont);
        const centeredSubX = x + (width - subtitleWidth) / 2;
        this.addText({ x: centeredSubX, y: currentY, text: displaySubtitle, font: String(subtitleFont), xMul: 1, yMul: 1 });
        currentY += subtitleLineHeight + lineSpacing;
      }
    }

    // Barcode at the bottom, centered (only if it fits)
    if (barcodeParams) {
      const barcodeY = y + height - barcodeHeight;
      // Use pre-calculated barcode width for centering
      const centeredBarcodeX = x + (width - barcodeParams.widthMm) / 2;

      this.addBarcode({
        x: centeredBarcodeX,
        y: barcodeY,
        data: barcodeParams.truncatedData,
        height: barcodeHeight,
        narrow: barcodeParams.narrow,
        showText: false
      });
    }
  }

  /**
   * Generate a label with text and barcode
   * Layout: Title (line 1), Subtitle (line 2), Barcode (line 3)
   * @param {object} data - Label data
   * @param {string} data.qrData - Data for QR code (legacy, used as barcode if no barcodeData)
   * @param {string} data.barcodeData - Data for barcode
   * @param {string} data.title - Title text (SKU) - max 22 chars for QR layout
   * @param {string} data.subtitle - Subtitle text (Batch) - max 34 chars for QR layout
   * @param {number} data.itemQuantity - Item quantity to display on label (for QR layout)
   * @param {number} data.quantity - Number of labels to print (rows)
   * @param {string} data.layout - Layout type: 'barcode' (default), 'qr', 'text-only'
   * @returns {string} TSPL commands
   */
  generateProductLabel(data) {
    const {
      qrData,
      barcodeData,
      title,
      subtitle,
      itemQuantity,
      quantity = 1,
      layout = 'barcode'
    } = data;

    const codeData = barcodeData || qrData;

    if (!title) {
      throw new Error('title is required');
    }

    const { layout: pageLayout } = this.pageConfig;
    const columns = pageLayout.columns || 1;

    const contentData = { title, subtitle, codeData, layoutType: layout, itemQuantity };
    const fullRows = Math.floor(quantity / columns);
    const remainder = quantity % columns;

    // Print full rows first (all columns filled) - use full row mode
    if (fullRows > 0) {
      this.initLabel(true); // Full row mode for multi-column
      for (let col = 0; col < columns; col++) {
        this._addStickerContent(contentData, col);
      }
      this.print(fullRows);
    }

    // Print partial row - use single sticker mode for each
    if (remainder > 0) {
      // For partial rows, print each sticker individually with single-sticker mode
      // This ensures correct padding on all sides
      for (let i = 0; i < remainder; i++) {
        this.initLabel(false); // Single sticker mode - correct padding
        this._addStickerContent(contentData, 0); // Always column 0 in single mode
        this.print(1);
      }
    }

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

module.exports = { TSPLGenerator, LAYOUT_CONFIG };
