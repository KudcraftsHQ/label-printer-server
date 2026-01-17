# Label Printer Server

An Electron-based desktop application that provides a local API server for printing labels using TSPL (TSC Printer Programming Language). Supports printing QR codes and text on thermal label printers via USB connection.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Features

- 🖨️ **TSPL Support** - Direct TSPL command generation for TSC thermal printers
- 📱 **QR Code Printing** - Built-in QR code generation and printing
- 🔌 **USB Communication** - Direct USB connection to thermal printers
- 📋 **Print Queue** - Automatic job queue management with status tracking
- ⚙️ **Multiple Page Configs** - Support for different label sizes and layouts
- 🌐 **REST API** - Local HTTP API for easy integration
- 💻 **Cross-Platform** - Works on Windows and macOS
- 📊 **Status Dashboard** - Built-in web interface for monitoring

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
  - [General Endpoints](#general-endpoints)
  - [Printer Management](#printer-management)
  - [Configuration](#configuration)
  - [Print Jobs](#print-jobs)
  - [Queue Management](#queue-management)
- [Page Configurations](#page-configurations)
- [TSPL Reference](#tspl-reference)
- [Development](#development)
- [Building](#building)
- [Configuration](#configuration-1)
- [Auto-Updates](#auto-updates)
- [Versioning & Releases](#versioning--releases)
- [API Integration Examples](#api-integration-examples)
- [Troubleshooting](#troubleshooting)
- [References](#references)

## Installation

### Prerequisites

- Node.js 16.x or higher
- npm or yarn
- USB thermal printer (TSC or compatible)

### Install Dependencies

```bash
npm install
```

## Quick Start

### Start the Application

```bash
npm start
```

The application will:
1. Start the API server on port 9632 (default)
2. Open the dashboard in an Electron window
3. Begin listening for USB printers

### Connect to a Printer

1. List available printers:
```bash
curl http://localhost:9632/printers
```

2. Connect to a printer:
```bash
curl -X POST http://localhost:9632/printers/connect \
  -H "Content-Type: application/json" \
  -d '{
    "vendorId": 4611,
    "productId": 2
  }'
```

### Print a Label

```bash
curl -X POST http://localhost:9632/print \
  -H "Content-Type: application/json" \
  -d '{
    "label": {
      "qrData": "20260115-00033",
      "title": "PEREDAM-CALYA-10MM",
      "subtitle": "20260115-00033"
    },
    "quantity": 1
  }'
```

## API Documentation

**Base URL:** `http://localhost:9632`

**Default Port:** 9632

### API Endpoints Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API information and available endpoints |
| GET | `/health` | Health check + printer/queue status |
| GET | `/printers` | List available USB printers |
| POST | `/printers/connect` | Connect to a specific printer |
| POST | `/printers/disconnect` | Disconnect from current printer |
| GET | `/printers/status` | Get current printer status |
| GET | `/configs` | Get all available label configurations |
| POST | `/print` | Queue a new print job |
| POST | `/print/custom` | Queue a custom TSPL print job |
| GET | `/jobs` | List all print jobs (with optional filters) |
| GET | `/jobs/:id` | Get details of a specific job |
| DELETE | `/jobs/:id` | Cancel or delete a print job |
| GET | `/queue/stats` | Get print queue statistics |
| POST | `/queue/clear` | Clear completed and cancelled jobs |

### General Endpoints

#### GET /
Get API information and available endpoints.

**Response:**
```json
{
  "name": "Label Printer Server",
  "version": "1.0.0",
  "description": "Local API server for TSPL label printing",
  "endpoints": { ... }
}
```

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-15T12:00:00.000Z",
  "printer": {
    "connected": true
  },
  "queue": {
    "total": 5,
    "pending": 1,
    "processing": 0,
    "completed": 4
  }
}
```

### Printer Management

#### GET /printers
List all available USB printers.

**Response:**
```json
{
  "success": true,
  "printers": [
    {
      "vendorId": 4611,
      "productId": 2,
      "manufacturer": "TSC",
      "product": "TTP-244 Plus",
      "deviceAddress": 5,
      "busNumber": 1
    }
  ]
}
```

#### POST /printers/connect
Connect to a USB printer.

**Request Body:**
```json
{
  "vendorId": 4611,
  "productId": 2
}
```

**Response:**
```json
{
  "success": true,
  "message": "Connected to printer",
  "printer": {
    "vendorId": 4611,
    "productId": 2
  }
}
```

#### POST /printers/disconnect
Disconnect from the current printer.

**Response:**
```json
{
  "success": true,
  "message": "Disconnected from printer"
}
```

#### GET /printers/status
Get current printer status.

**Response:**
```json
{
  "success": true,
  "status": {
    "connected": true,
    "ready": true,
    "status": "ready",
    "device": {
      "vendorId": 4611,
      "productId": 2
    }
  }
}
```

### Configuration

#### GET /configs
Get all available page configurations.

**Response:**
```json
{
  "success": true,
  "configs": {
    "default": {
      "name": "Default (3x33mm)",
      "sticker": {
        "width": 33,
        "height": 15
      },
      "layout": {
        "columns": 3,
        "gap": 3,
        "outerMargin": 1.5
      },
      "pageWidth": 105,
      "pageHeight": 18
    },
    "double_50x20": { ... }
  }
}
```

### Print Jobs

#### POST /print
Add a new print job to the queue.

**Request Body:**
```json
{
  "pageConfig": "default",
  "label": {
    "qrData": "https://example.com/product/12345",
    "title": "PRODUCT-NAME-ABC",
    "subtitle": "SKU-12345-XYZ"
  },
  "quantity": 10
}
```

**Parameters:**
- `pageConfig` (string, optional) - Page configuration ID (default: "default")
- `label` (object, required):
  - `qrData` (string, required) - Data to encode in QR code
  - `title` (string, required) - Main text on label
  - `subtitle` (string, optional) - Secondary text on label
- `quantity` (number, optional) - Number of labels to print (default: 1)

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "pending",
    "createdAt": "2026-01-15T12:00:00.000Z"
  }
}
```

#### POST /print/custom
Add a custom TSPL print job.

**Request Body:**
```json
{
  "tspl": "SIZE 1.30,0.59\r\nGAP 0.12,0\r\nDIRECTION 0\r\nCLS\r\nQRCODE 16,16,H,4,A,0,\"TEST\"\r\nPRINT 1"
}
```

**Parameters:**
- `tspl` (string, required) - Raw TSPL commands

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "pending",
    "createdAt": "2026-01-15T12:00:00.000Z"
  }
}
```

#### GET /jobs
List all print jobs.

**Query Parameters:**
- `status` (string, optional) - Filter by status: `pending`, `processing`, `completed`, `failed`, `cancelled`
- `limit` (number, optional) - Limit number of results

**Example:**
```
GET /jobs?status=completed&limit=10
```

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "status": "completed",
      "pageConfig": "default",
      "label": {
        "qrData": "20260115-00033",
        "title": "PEREDAM-CALYA-10MM",
        "subtitle": "20260115-00033"
      },
      "quantity": 1,
      "createdAt": "2026-01-15T12:00:00.000Z",
      "updatedAt": "2026-01-15T12:00:05.000Z",
      "error": null
    }
  ]
}
```

#### GET /jobs/:id
Get a specific print job by ID.

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "completed",
    "pageConfig": "default",
    "label": { ... },
    "quantity": 1,
    "createdAt": "2026-01-15T12:00:00.000Z",
    "updatedAt": "2026-01-15T12:00:05.000Z",
    "error": null,
    "tspl": "SIZE 1.30,0.59\r\n..."
  }
}
```

#### DELETE /jobs/:id
Cancel or delete a print job.

**Response:**
```json
{
  "success": true,
  "message": "Job cancelled"
}
```

### Queue Management

#### GET /queue/stats
Get print queue statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 15,
    "pending": 2,
    "processing": 1,
    "completed": 10,
    "failed": 1,
    "cancelled": 1,
    "currentJob": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

#### POST /queue/clear
Clear all completed and cancelled jobs.

**Response:**
```json
{
  "success": true,
  "message": "Cleared 10 completed jobs",
  "count": 10
}
```

## Page Configurations

The application supports multiple page configurations for different label sizes:

### Default (3x33mm)
- Config ID: `default`
- 3 stickers per row
- Sticker size: 33mm × 15mm
- Gap between stickers: 3mm
- Outer margin: 1.5mm
- Total page width: 105mm

### Double 50x20 (2x50mm)
- Config ID: `double_50x20`
- 2 stickers per row
- Sticker size: 50mm × 20mm
- Gap between stickers: 3mm
- Outer margin: 1.5mm
- Total page width: 106mm

## TSPL Reference

### Basic Commands

The application generates TSPL commands for TSC thermal printers. Here are the main commands used:

#### SIZE
Set label size in inches.
```
SIZE width,height
```
Example: `SIZE 1.30,0.59` (33mm × 15mm)

#### GAP
Define gap between labels.
```
GAP gap,offset
```
Example: `GAP 0.12,0` (3mm gap)

#### CLS
Clear the label buffer.
```
CLS
```

#### QRCODE
Print a QR code.
```
QRCODE x,y,ECC_level,cell_width,mode,rotation,"data"
```
- **x, y**: Position in dots (203 DPI: 8 dots/mm)
- **ECC_level**: Error correction (L=7%, M=15%, Q=25%, H=30%)
- **cell_width**: 1-10 (size of QR modules)
- **mode**: A=Auto, M=Manual
- **rotation**: 0, 90, 180, 270

Example: `QRCODE 16,16,H,4,A,0,"20260115-00033"`

#### TEXT
Print text.
```
TEXT x,y,"font",rotation,x_mul,y_mul,"content"
```
- **x, y**: Position in dots
- **font**: Font number (1-8) or font name
- **rotation**: 0, 90, 180, 270
- **x_mul, y_mul**: Multiplication factors (1-10)

Example: `TEXT 112,16,"3",0,1,1,"PEREDAM-CALYA-10MM"`

#### PRINT
Output the label.
```
PRINT quantity,copies
```
Example: `PRINT 1,1`

### Complete Example

```
SIZE 1.30,0.59
GAP 0.12,0
DIRECTION 0
CLS
QRCODE 16,16,H,3,A,0,"20260115-00033"
TEXT 112,16,"3",0,1,1,"PEREDAM-CALYA-10MM"
TEXT 112,64,"3",0,1,1,"20260115-00033"
PRINT 1
```

## Development

### Run in Development Mode

```bash
npm run dev
```

This will start the application with nodemon for auto-restart on file changes.

### Project Structure

```
label-printer-server/
├── src/
│   ├── api/
│   │   └── server.js           # Express API server
│   ├── printer/
│   │   ├── printer-manager.js  # USB printer communication
│   │   ├── print-queue.js      # Print job queue management
│   │   └── tspl-generator.js   # TSPL command generator
│   ├── config/
│   │   └── page-configs.js     # Page layout configurations
│   ├── utils/
│   │   └── logger.js           # Winston logger
│   ├── main.js                 # Electron main process
│   └── index.html              # Dashboard UI
├── logs/                       # Application logs
├── package.json
└── README.md
```

## Building

Build executables for distribution:

### Windows
```bash
npm run build:win
```

### macOS
```bash
npm run build:mac
```

### All Platforms
```bash
npm run build:all
```

Built applications will be in the `dist/` directory.

## Configuration

User settings are automatically saved and stored at:
- **Windows:** `%APPDATA%/label-printer-server/config.json`
- **macOS:** `~/Library/Application Support/label-printer-server/config.json`

### Configuration Schema

```json
{
  "version": "1.0.0",
  "printer": {
    "vendorId": 1234,
    "productId": 5678,
    "name": "Printer Name"
  },
  "network": {
    "port": 9632
  },
  "defaults": {
    "pageConfig": "default"
  },
  "startup": {
    "launchOnBoot": true,
    "startMinimized": false
  },
  "setupCompleted": true
}
```

### First-Time Setup

On first launch, the application will show a setup wizard to:
1. Detect and select your USB thermal printer
2. Choose your default label configuration
3. Configure startup options

Once setup is complete, the application will remember your preferences.

## Auto-Updates

The application includes automatic update functionality:
- Checks for new releases from GitHub on startup
- Downloads updates silently in the background
- Installs updates automatically when you quit the app
- No manual update process required

Updates are delivered through GitHub Releases and use the `electron-updater` framework.

## Versioning & Releases

This project follows [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH):

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Bug fix, printer compatibility | PATCH | 1.0.0 → 1.0.1 |
| New feature, new API endpoint | MINOR | 1.0.1 → 1.1.0 |
| Breaking API change, major rewrite | MAJOR | 1.1.0 → 2.0.0 |

### Release Process

Every push to `main` with a version tag triggers an automated release:

```bash
# Bump version (creates commit + tag automatically)
npm version patch   # Bug fix: 1.0.0 → 1.0.1
npm version minor   # New feature: 1.0.1 → 1.1.0
npm version major   # Breaking change: 1.1.0 → 2.0.0

# Push commit and tags
git push && git push --tags
```

GitHub Actions will:
1. Build Windows installer: `Label-Printer-Server-Setup-{version}.exe`
2. Create GitHub Release with changelog
3. Enable auto-update for existing installations

## API Integration Examples

### Python Example

```python
import requests

API_BASE = "http://localhost:9632"

# Check server health
response = requests.get(f"{API_BASE}/health")
print(response.json())

# Print a label
label_data = {
    "pageConfig": "default",
    "label": {
        "qrData": "PRODUCT-12345",
        "title": "My Product",
        "subtitle": "SKU-12345"
    },
    "quantity": 5
}

response = requests.post(f"{API_BASE}/print", json=label_data)
print(response.json())
```

### JavaScript/Node.js Example

```javascript
const axios = require('axios');

const API_BASE = 'http://localhost:9632';

// Check server health
async function checkHealth() {
  const response = await axios.get(`${API_BASE}/health`);
  console.log(response.data);
}

// Print a label
async function printLabel() {
  const labelData = {
    pageConfig: 'default',
    label: {
      qrData: 'PRODUCT-12345',
      title: 'My Product',
      subtitle: 'SKU-12345'
    },
    quantity: 5
  };

  const response = await axios.post(`${API_BASE}/print`, labelData);
  console.log(response.data);
}

checkHealth();
printLabel();
```

### cURL Examples

```bash
# Check health
curl http://localhost:9632/health

# List available printers
curl http://localhost:9632/printers

# Connect to a printer
curl -X POST http://localhost:9632/printers/connect \
  -H "Content-Type: application/json" \
  -d '{"vendorId": 4611, "productId": 2}'

# Print a label
curl -X POST http://localhost:9632/print \
  -H "Content-Type: application/json" \
  -d '{
    "label": {
      "qrData": "TEST-001",
      "title": "Test Label",
      "subtitle": "Sample"
    },
    "quantity": 1
  }'

# Get queue statistics
curl http://localhost:9632/queue/stats

# List all jobs
curl http://localhost:9632/jobs

# Get specific job
curl http://localhost:9632/jobs/a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Cancel a job
curl -X DELETE http://localhost:9632/jobs/a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Clear completed jobs
curl -X POST http://localhost:9632/queue/clear
```

## Troubleshooting

### Printer Not Detected

1. Check USB connection
2. On Linux, ensure you have proper USB permissions:
   ```bash
   sudo usermod -a -G lp $USER
   ```
3. Check vendor ID and product ID with `lsusb` (Linux/macOS)

### Print Jobs Stuck in Queue

1. Check printer connection: `GET /printers/status`
2. Ensure printer is powered on and has paper
3. Check logs in `logs/combined.log`

### Port Already in Use

The default port is 9632. If this port is already in use, the server will fail to start. You can:
1. Stop the application using port 9632
2. Manually configure a different port in `config.json`
3. Check the dashboard or logs to confirm the active port

## References

This application implements TSPL (TSC Printer Programming Language) for thermal label printers. For more information:

- [TSPL/TSPL2 Programming Manual](https://www.servopack.de/support/tsc/TSPL_TSPL2_Programming.pdf)
- [TSC Printers](https://www.tscprinters.com/)
- [QR Code Error Correction](https://www.qrcode.com/en/about/error_correction.html)

## License

MIT