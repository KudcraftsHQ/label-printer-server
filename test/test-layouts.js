#!/usr/bin/env node
/**
 * Test script for label printing layouts
 * Tests various edge cases for text overflow, font sizing, and different layouts
 */

const API_URL = 'http://localhost:3000';

// Test cases organized by category
const TEST_CASES = {
  // Text length variations
  textLengths: [
    {
      name: 'Short title',
      label: { title: 'ABC', subtitle: '123', barcodeData: 'SKU1', layout: 'barcode' }
    },
    {
      name: 'Medium title',
      label: { title: 'Product Name', subtitle: 'Item #12345', barcodeData: 'SKU-12345', layout: 'barcode' }
    },
    {
      name: 'Long title (should auto-shrink)',
      label: { title: 'Very Long Product Name Here', subtitle: 'Extended Description', barcodeData: 'SKU-LONG-12345', layout: 'barcode' }
    },
    {
      name: 'Very long title (should truncate)',
      label: { title: 'This Is An Extremely Long Product Name That Should Be Truncated', subtitle: 'This subtitle is also very long and needs truncation', barcodeData: 'VERYLONGSKUCODE123456789', layout: 'barcode' }
    },
  ],

  // Layout variations
  layouts: [
    {
      name: 'Barcode layout',
      label: { title: 'Barcode Test', subtitle: 'With barcode', barcodeData: 'TEST123', layout: 'barcode' }
    },
    {
      name: 'QR code layout',
      label: { title: 'QR Test', subtitle: 'With QR', qrData: 'https://example.com/product/123', layout: 'qr' }
    },
    {
      name: 'Text only layout',
      label: { title: 'Text Only', subtitle: 'No barcode', layout: 'text-only' }
    },
  ],

  // Optional fields
  optionalFields: [
    {
      name: 'Title only (no subtitle, no barcode)',
      label: { title: 'Just Title', layout: 'barcode' }
    },
    {
      name: 'Title + subtitle (no barcode)',
      label: { title: 'Title Here', subtitle: 'Subtitle Here', layout: 'barcode' }
    },
    {
      name: 'Title + barcode (no subtitle)',
      label: { title: 'With Barcode', barcodeData: 'CODE123', layout: 'barcode' }
    },
    {
      name: 'All fields',
      label: { title: 'Complete', subtitle: 'All Fields', barcodeData: 'FULL123', layout: 'barcode' }
    },
  ],

  // Barcode length variations
  barcodeLengths: [
    {
      name: 'Short barcode (4 chars)',
      label: { title: 'Short Code', barcodeData: 'ABCD', layout: 'barcode' }
    },
    {
      name: 'Medium barcode (10 chars)',
      label: { title: 'Medium Code', barcodeData: 'ABCDE12345', layout: 'barcode' }
    },
    {
      name: 'Long barcode (20 chars)',
      label: { title: 'Long Code', barcodeData: 'ABCDEFGHIJ1234567890', layout: 'barcode' }
    },
  ],

  // Special characters
  specialChars: [
    {
      name: 'Numbers only',
      label: { title: '12345678', subtitle: '87654321', barcodeData: '123456', layout: 'barcode' }
    },
    {
      name: 'Mixed case',
      label: { title: 'AbCdEfGh', subtitle: 'IjKlMnOp', barcodeData: 'MiXeD123', layout: 'barcode' }
    },
    {
      name: 'With spaces',
      label: { title: 'Product A B C', subtitle: 'Item 1 2 3', barcodeData: 'SKU123', layout: 'barcode' }
    },
  ],
};

// Helper function to make API requests
async function apiRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, options);
  return response.json();
}

// Connect to printer
async function connectPrinter() {
  console.log('Connecting to printer...');
  const result = await apiRequest('/printers/connect', 'POST', { vendorId: 1137, productId: 85 });
  if (result.success) {
    console.log('✓ Connected to printer\n');
    return true;
  } else {
    console.log('✗ Failed to connect:', result.error);
    return false;
  }
}

// Run a single test case (no actual print, just generate TSPL)
async function testCase(testName, label, dryRun = true) {
  console.log(`Testing: ${testName}`);
  console.log(`  Title: "${label.title}" (${label.title?.length || 0} chars)`);
  if (label.subtitle) console.log(`  Subtitle: "${label.subtitle}" (${label.subtitle?.length || 0} chars)`);
  if (label.barcodeData) console.log(`  Barcode: "${label.barcodeData}" (${label.barcodeData?.length || 0} chars)`);
  if (label.qrData) console.log(`  QR: "${label.qrData}"`);
  console.log(`  Layout: ${label.layout}`);

  if (!dryRun) {
    const result = await apiRequest('/print', 'POST', {
      pageConfig: 'default',
      label,
      quantity: 1
    });

    if (result.success) {
      // Wait a bit and check job status
      await new Promise(r => setTimeout(r, 500));
      const jobResult = await apiRequest(`/jobs/${result.job.id}`);

      if (jobResult.job.status === 'completed') {
        console.log(`  ✓ Printed successfully`);
        // Show TSPL for debugging
        const tsplLines = jobResult.job.tspl.split('\r\n').filter(l => l);
        console.log(`  TSPL commands: ${tsplLines.length} lines`);
      } else {
        console.log(`  ✗ Print failed: ${jobResult.job.error}`);
      }
    } else {
      console.log(`  ✗ API error: ${result.error}`);
    }
  } else {
    console.log(`  (dry run - not printed)`);
  }
  console.log('');
}

// Run all tests in a category
async function runCategory(categoryName, tests, dryRun = true) {
  console.log('='.repeat(60));
  console.log(`Category: ${categoryName}`);
  console.log('='.repeat(60));
  console.log('');

  for (const test of tests) {
    await testCase(test.name, test.label, dryRun);
  }
}

// Main test runner
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--print');
  const category = args.find(a => !a.startsWith('--'));

  console.log('Label Printer Layout Test Suite');
  console.log('================================\n');

  if (dryRun) {
    console.log('Mode: DRY RUN (use --print to actually print)\n');
  } else {
    console.log('Mode: PRINTING TO PRINTER\n');
    const connected = await connectPrinter();
    if (!connected) {
      console.log('Cannot proceed without printer connection.');
      process.exit(1);
    }
  }

  // Run specified category or all
  if (category && TEST_CASES[category]) {
    await runCategory(category, TEST_CASES[category], dryRun);
  } else {
    // Run all categories
    for (const [catName, tests] of Object.entries(TEST_CASES)) {
      await runCategory(catName, tests, dryRun);
    }
  }

  console.log('='.repeat(60));
  console.log('Test suite complete!');
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('\nTo actually print labels, run with --print flag:');
    console.log('  node test/test-layouts.js --print');
    console.log('  node test/test-layouts.js textLengths --print');
  }
}

// Run if called directly
main().catch(console.error);
