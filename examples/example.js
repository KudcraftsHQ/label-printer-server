/**
 * Example Node.js integration with Label Printer Server
 *
 * This example shows how to integrate the label printer API
 * into a Node.js application.
 */

const API_URL = 'http://localhost:3000';

/**
 * Make API request
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  return response.json();
}

/**
 * List available printers
 */
async function listPrinters() {
  console.log('Listing available printers...');
  const result = await apiRequest('/printers');
  console.log(result);
  return result;
}

/**
 * Connect to a printer
 */
async function connectPrinter(vendorId, productId) {
  console.log(`Connecting to printer ${vendorId}:${productId}...`);
  const result = await apiRequest('/printers/connect', {
    method: 'POST',
    body: JSON.stringify({ vendorId, productId })
  });
  console.log(result);
  return result;
}

/**
 * Print a label
 */
async function printLabel(labelData) {
  console.log('Submitting print job...');
  const result = await apiRequest('/print', {
    method: 'POST',
    body: JSON.stringify(labelData)
  });
  console.log('Job created:', result);
  return result;
}

/**
 * Check job status
 */
async function checkJobStatus(jobId) {
  console.log(`Checking job ${jobId}...`);
  const result = await apiRequest(`/jobs/${jobId}`);
  console.log(result);
  return result;
}

/**
 * Get queue statistics
 */
async function getQueueStats() {
  console.log('Getting queue statistics...');
  const result = await apiRequest('/queue/stats');
  console.log(result);
  return result;
}

/**
 * Main example workflow
 */
async function main() {
  try {
    console.log('=== Label Printer API Example ===\n');

    // 1. List printers
    const printers = await listPrinters();
    console.log('\n---\n');

    // 2. Connect to first printer (if available)
    if (printers.printers && printers.printers.length > 0) {
      const printer = printers.printers[0];
      await connectPrinter(printer.vendorId, printer.productId);
      console.log('\n---\n');
    }

    // 3. Print a label
    const printJob = await printLabel({
      pageConfig: 'default',
      label: {
        qrData: 'https://example.com/product/ABC-123',
        title: 'PRODUCT-ABC-123',
        subtitle: 'Batch: 2026-01-15'
      },
      quantity: 1
    });
    console.log('\n---\n');

    // 4. Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. Check job status
    if (printJob.job && printJob.job.id) {
      await checkJobStatus(printJob.job.id);
      console.log('\n---\n');
    }

    // 6. Get queue stats
    await getQueueStats();

    console.log('\n=== Example completed ===');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the example
if (require.main === module) {
  main();
}

module.exports = {
  apiRequest,
  listPrinters,
  connectPrinter,
  printLabel,
  checkJobStatus,
  getQueueStats
};
