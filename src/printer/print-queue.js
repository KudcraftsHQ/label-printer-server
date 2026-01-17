const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const { getPrinterManager } = require('./printer-manager');
const { TSPLGenerator } = require('./tspl-generator');

/**
 * Print job statuses
 */
const JobStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Print Queue Manager
 */
class PrintQueue {
  constructor() {
    this.jobs = new Map();
    this.processing = false;
    this.currentJob = null;
  }

  /**
   * Add a new print job to the queue
   * @param {object} jobData - Job data
   * @param {string} jobData.pageConfig - Page configuration ID
   * @param {object} jobData.label - Label data
   * @param {number} jobData.quantity - Number of copies
   * @param {number} jobData.padding - Internal padding in mm (optional, default: 1.5)
   * @param {number} jobData.horizontalOffset - Horizontal offset in mm for calibration (optional)
   * @param {number} jobData.verticalOffset - Vertical offset in mm for calibration (optional)
   * @returns {object} Created job
   */
  addJob(jobData) {
    const job = {
      id: uuidv4(),
      status: JobStatus.PENDING,
      pageConfig: jobData.pageConfig || 'default',
      label: jobData.label,
      quantity: jobData.quantity || 1,
      padding: jobData.padding,
      horizontalOffset: jobData.horizontalOffset,
      verticalOffset: jobData.verticalOffset,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: null,
      tspl: null
    };

    this.jobs.set(job.id, job);
    logger.info('Job added to queue', { jobId: job.id });

    // Start processing if not already processing
    if (!this.processing) {
      this.processQueue();
    }

    return job;
  }

  /**
   * Add a custom TSPL job to the queue
   * @param {object} jobData - Job data
   * @param {string} jobData.tspl - Raw TSPL commands
   * @returns {object} Created job
   */
  addCustomJob(jobData) {
    const job = {
      id: uuidv4(),
      status: JobStatus.PENDING,
      pageConfig: 'custom',
      label: { custom: true },
      quantity: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: null,
      tspl: jobData.tspl
    };

    this.jobs.set(job.id, job);
    logger.info('Custom job added to queue', { jobId: job.id });

    if (!this.processing) {
      this.processQueue();
    }

    return job;
  }

  /**
   * Add a batch print job to the queue (multiple unique labels)
   * @param {object} jobData - Job data
   * @param {string} jobData.pageConfig - Page configuration ID
   * @param {Array} jobData.labels - Array of label objects {title, subtitle, qrData}
   * @param {number} jobData.padding - Internal padding in mm (optional, default: 1.5)
   * @param {number} jobData.horizontalOffset - Horizontal offset in mm for calibration (optional)
   * @param {number} jobData.verticalOffset - Vertical offset in mm for calibration (optional)
   * @returns {object} Created job
   */
  addBatchJob(jobData) {
    const job = {
      id: uuidv4(),
      status: JobStatus.PENDING,
      pageConfig: jobData.pageConfig || 'default',
      labels: jobData.labels,  // Array of label objects
      isBatch: true,
      padding: jobData.padding,
      horizontalOffset: jobData.horizontalOffset,
      verticalOffset: jobData.verticalOffset,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: null,
      tspl: null
    };

    this.jobs.set(job.id, job);
    logger.info(`Batch job ${job.id} added with ${job.labels.length} labels`);

    if (!this.processing) {
      this.processQueue();
    }

    return job;
  }

  /**
   * Get a job by ID
   * @param {string} jobId - Job ID
   * @returns {object|null} Job or null if not found
   */
  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get all jobs
   * @param {object} filter - Filter options
   * @param {string} filter.status - Filter by status
   * @param {number} filter.limit - Limit number of results
   * @returns {Array} List of jobs
   */
  getAllJobs(filter = {}) {
    let jobs = Array.from(this.jobs.values());

    // Filter by status
    if (filter.status) {
      jobs = jobs.filter(job => job.status === filter.status);
    }

    // Sort by creation date (newest first)
    jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Limit results
    if (filter.limit) {
      jobs = jobs.slice(0, filter.limit);
    }

    return jobs;
  }

  /**
   * Cancel a job
   * @param {string} jobId - Job ID
   * @returns {boolean} Success status
   */
  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.status === JobStatus.PENDING) {
      job.status = JobStatus.CANCELLED;
      job.updatedAt = new Date().toISOString();
      logger.info('Job cancelled', { jobId });
      return true;
    } else if (job.status === JobStatus.PROCESSING) {
      logger.warn('Cannot cancel job in processing', { jobId });
      return false;
    }

    return false;
  }

  /**
   * Delete a job
   * @param {string} jobId - Job ID
   * @returns {boolean} Success status
   */
  deleteJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.status === JobStatus.PROCESSING) {
      logger.warn('Cannot delete job in processing', { jobId });
      return false;
    }

    this.jobs.delete(jobId);
    logger.info('Job deleted', { jobId });
    return true;
  }

  /**
   * Process the print queue
   */
  async processQueue() {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      while (true) {
        // Find next pending job
        const nextJob = Array.from(this.jobs.values()).find(
          job => job.status === JobStatus.PENDING
        );

        if (!nextJob) {
          break;
        }

        await this.processJob(nextJob);
      }
    } catch (error) {
      logger.error('Error processing queue', { error: error.message });
    } finally {
      this.processing = false;
      this.currentJob = null;
    }
  }

  /**
   * Process a single job
   * @param {object} job - Job to process
   */
  async processJob(job) {
    this.currentJob = job;
    job.status = JobStatus.PROCESSING;
    job.updatedAt = new Date().toISOString();

    logger.info('Processing job', { jobId: job.id });

    try {
      // Generate TSPL if not already provided
      if (!job.tspl) {
        const generator = new TSPLGenerator({
          pageConfigId: job.pageConfig,
          padding: job.padding,
          horizontalOffset: job.horizontalOffset,
          verticalOffset: job.verticalOffset
        });

        if (job.isBatch) {
          // Batch job: generate labels for multiple unique items
          job.tspl = generator.generateBatchLabels({ labels: job.labels });
        } else {
          // Single job: generate label with quantity
          job.tspl = generator.generateProductLabel({
            qrData: job.label.qrData,
            barcodeData: job.label.barcodeData,
            title: job.label.title,
            subtitle: job.label.subtitle,
            itemQuantity: job.label.itemQuantity,
            layout: job.label.layout || 'barcode',
            quantity: job.quantity
          });
        }
      }

      // Get printer manager
      const printerManager = getPrinterManager();

      // Check if printer is connected
      if (!printerManager.isConnected()) {
        throw new Error('Printer not connected');
      }

      // Send to printer
      await printerManager.print(job.tspl);

      // Mark as completed
      job.status = JobStatus.COMPLETED;
      job.updatedAt = new Date().toISOString();
      logger.info('Job completed', { jobId: job.id });
    } catch (error) {
      logger.error('Job failed', { jobId: job.id, error: error.message });
      job.status = JobStatus.FAILED;
      job.error = error.message;
      job.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Get queue statistics
   * @returns {object} Queue stats
   */
  getStats() {
    const jobs = Array.from(this.jobs.values());
    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === JobStatus.PENDING).length,
      processing: jobs.filter(j => j.status === JobStatus.PROCESSING).length,
      completed: jobs.filter(j => j.status === JobStatus.COMPLETED).length,
      failed: jobs.filter(j => j.status === JobStatus.FAILED).length,
      cancelled: jobs.filter(j => j.status === JobStatus.CANCELLED).length,
      currentJob: this.currentJob ? this.currentJob.id : null
    };
  }

  /**
   * Clear completed and cancelled jobs
   * @returns {number} Number of jobs cleared
   */
  clearCompleted() {
    const jobs = Array.from(this.jobs.values());
    let cleared = 0;

    jobs.forEach(job => {
      if (job.status === JobStatus.COMPLETED || job.status === JobStatus.CANCELLED) {
        this.jobs.delete(job.id);
        cleared++;
      }
    });

    logger.info('Cleared completed jobs', { count: cleared });
    return cleared;
  }
}

// Singleton instance
let printQueueInstance = null;

/**
 * Get print queue instance
 * @returns {PrintQueue} Print queue singleton
 */
function getPrintQueue() {
  if (!printQueueInstance) {
    printQueueInstance = new PrintQueue();
  }
  return printQueueInstance;
}

module.exports = { PrintQueue, getPrintQueue, JobStatus };
