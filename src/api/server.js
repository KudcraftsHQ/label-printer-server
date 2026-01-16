const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { logger } = require('../utils/logger');
const { getPrinterManager } = require('../printer/printer-manager');
const { getPrintQueue } = require('../printer/print-queue');
const { getAllPageConfigs } = require('../config/page-configs');

const app = express();
const DEFAULT_PORT = 9632;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    body: req.body
  });
  next();
});

// ============================================================================
// API Routes
// ============================================================================

/**
 * GET / - API Info
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Label Printer Server',
    version: '1.0.0',
    description: 'Local API server for TSPL label printing',
    endpoints: {
      'GET /': 'API information',
      'GET /health': 'Health check',
      'GET /printers': 'List available USB printers',
      'POST /printers/connect': 'Connect to a printer',
      'POST /printers/disconnect': 'Disconnect from printer',
      'GET /printers/status': 'Get printer status',
      'GET /configs': 'Get available page configurations',
      'POST /print': 'Add a print job to the queue',
      'POST /print/custom': 'Add a custom TSPL print job',
      'GET /jobs': 'List all print jobs',
      'GET /jobs/:id': 'Get a specific job',
      'DELETE /jobs/:id': 'Cancel/delete a job',
      'GET /queue/stats': 'Get queue statistics',
      'POST /queue/clear': 'Clear completed jobs'
    }
  });
});

/**
 * GET /health - Health Check
 */
app.get('/health', (req, res) => {
  const printerManager = getPrinterManager();
  const printQueue = getPrintQueue();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    printer: {
      connected: printerManager.isConnected()
    },
    queue: printQueue.getStats()
  });
});

/**
 * GET /printers - List Available Printers
 */
app.get('/printers', (req, res) => {
  try {
    const printerManager = getPrinterManager();
    const printers = printerManager.listPrinters();

    res.json({
      success: true,
      printers
    });
  } catch (error) {
    logger.error('Error listing printers', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /printers/connect - Connect to Printer
 * Body: { vendorId: number, productId: number }
 */
app.post('/printers/connect', (req, res) => {
  try {
    const { vendorId, productId } = req.body;

    if (!vendorId || !productId) {
      return res.status(400).json({
        success: false,
        error: 'vendorId and productId are required'
      });
    }

    const printerManager = getPrinterManager();
    printerManager.connect({ vendorId, productId });

    res.json({
      success: true,
      message: 'Connected to printer',
      printer: {
        vendorId,
        productId
      }
    });
  } catch (error) {
    logger.error('Error connecting to printer', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /printers/disconnect - Disconnect from Printer
 */
app.post('/printers/disconnect', (req, res) => {
  try {
    const printerManager = getPrinterManager();
    printerManager.disconnect();

    res.json({
      success: true,
      message: 'Disconnected from printer'
    });
  } catch (error) {
    logger.error('Error disconnecting from printer', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /printers/status - Get Printer Status
 */
app.get('/printers/status', (req, res) => {
  try {
    const printerManager = getPrinterManager();
    const status = printerManager.getStatus();

    res.json({
      success: true,
      status
    });
  } catch (error) {
    logger.error('Error getting printer status', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /configs - Get Available Page Configurations
 */
app.get('/configs', (req, res) => {
  try {
    const configs = getAllPageConfigs();

    // Format configs for API response
    const formattedConfigs = {};
    for (const [id, config] of Object.entries(configs)) {
      formattedConfigs[id] = {
        name: config.name,
        sticker: config.sticker,
        layout: config.layout,
        pageWidth: config.pageWidth,
        pageHeight: config.pageHeight
      };
    }

    res.json({
      success: true,
      configs: formattedConfigs
    });
  } catch (error) {
    logger.error('Error getting configs', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /print - Add Print Job
 * Body: {
 *   pageConfig: string (optional, default: 'default'),
 *   label: {
 *     qrData: string (required),
 *     title: string (required),
 *     subtitle: string (optional)
 *   },
 *   quantity: number (optional, default: 1)
 * }
 */
app.post('/print', (req, res) => {
  try {
    const { pageConfig, label, quantity } = req.body;

    // Validate required fields - title is required, barcode/qr is optional
    if (!label || !label.title) {
      return res.status(400).json({
        success: false,
        error: 'label.title is required'
      });
    }

    const printQueue = getPrintQueue();
    const job = printQueue.addJob({
      pageConfig: pageConfig || 'default',
      label,
      quantity: quantity || 1
    });

    res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        createdAt: job.createdAt
      }
    });
  } catch (error) {
    logger.error('Error adding print job', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /print/custom - Add Custom TSPL Print Job
 * Body: {
 *   tspl: string (required - raw TSPL commands)
 * }
 */
app.post('/print/custom', (req, res) => {
  try {
    const { tspl } = req.body;

    if (!tspl) {
      return res.status(400).json({
        success: false,
        error: 'tspl commands are required'
      });
    }

    const printQueue = getPrintQueue();
    const job = printQueue.addCustomJob({ tspl });

    res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        createdAt: job.createdAt
      }
    });
  } catch (error) {
    logger.error('Error adding custom print job', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /jobs - List All Jobs
 * Query params:
 *   - status: filter by status (optional)
 *   - limit: limit number of results (optional)
 */
app.get('/jobs', (req, res) => {
  try {
    const { status, limit } = req.query;

    const printQueue = getPrintQueue();
    const jobs = printQueue.getAllJobs({
      status,
      limit: limit ? parseInt(limit) : undefined
    });

    res.json({
      success: true,
      jobs
    });
  } catch (error) {
    logger.error('Error getting jobs', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /jobs/:id - Get Specific Job
 */
app.get('/jobs/:id', (req, res) => {
  try {
    const { id } = req.params;

    const printQueue = getPrintQueue();
    const job = printQueue.getJob(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      job
    });
  } catch (error) {
    logger.error('Error getting job', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /jobs/:id - Cancel/Delete Job
 */
app.delete('/jobs/:id', (req, res) => {
  try {
    const { id } = req.params;

    const printQueue = getPrintQueue();
    const job = printQueue.getJob(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // Try to cancel first, if that fails, try to delete
    const cancelled = printQueue.cancelJob(id);
    if (cancelled) {
      return res.json({
        success: true,
        message: 'Job cancelled'
      });
    }

    const deleted = printQueue.deleteJob(id);
    if (deleted) {
      return res.json({
        success: true,
        message: 'Job deleted'
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Cannot cancel or delete job in processing'
    });
  } catch (error) {
    logger.error('Error cancelling/deleting job', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /queue/stats - Get Queue Statistics
 */
app.get('/queue/stats', (req, res) => {
  try {
    const printQueue = getPrintQueue();
    const stats = printQueue.getStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error getting queue stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /queue/clear - Clear Completed Jobs
 */
app.post('/queue/clear', (req, res) => {
  try {
    const printQueue = getPrintQueue();
    const cleared = printQueue.clearCompleted();

    res.json({
      success: true,
      message: `Cleared ${cleared} completed jobs`,
      count: cleared
    });
  } catch (error) {
    logger.error('Error clearing queue', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

/**
 * Start the API server
 * @param {number} port - Port to listen on
 * @returns {Promise<object>} Server instance
 */
function startApiServer(port = DEFAULT_PORT) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      logger.info(`API Server listening on port ${port}`);
      resolve({ server, port, close: () => server.close() });
    }).on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.warn(`Port ${port} in use, trying ${port + 1}`);
        startApiServer(port + 1).then(resolve).catch(reject);
      } else {
        reject(error);
      }
    });
  });
}

module.exports = { app, startApiServer };
