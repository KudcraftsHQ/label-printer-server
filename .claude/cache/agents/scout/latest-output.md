# Codebase Report: Label Printer Server - Printer Display & Information
Generated: 2026-01-16

## Summary
The label-printer-server is an Electron-based application with a simple architecture. Currently, it displays **minimal printer information** in the UI - only basic connection status. The UI is a single HTML page that polls the API for status updates. There is **no IPC communication** between renderer and main process; instead, the UI directly calls the HTTP API that runs on localhost:3000.

## Project Structure
```
label-printer-server/
├── src/
│   ├── api/
│   │   └── server.js           # Express REST API (all endpoints)
│   ├── printer/
│   │   ├── printer-manager.js  # USB printer communication & discovery
│   │   ├── print-queue.js      # Print job queue management
│   │   └── tspl-generator.js   # TSPL command generator
│   ├── config/
│   │   └── page-configs.js     # Page layout configurations
│   ├── utils/
│   │   └── logger.js           # Winston logger
│   ├── main.js                 # Electron main process
│   └── index.html              # Dashboard UI (renderer)
└── logs/                        # Application logs
```

## Questions Answered

### Q1: How are printers currently displayed in the UI?
**Location:** `/Users/hammashamzah/Projects/label-printer-server/src/index.html`

**Current Display:** Very minimal - only a simple status indicator:

```html
<!-- Line 183-185 in index.html -->
<div class="status-item">
  <span class="status-label">Printer Status:</span>
  <span class="status-value" id="printer-status">Loading...</span>
</div>
```

**Display Logic:** (Lines 258-264)
```javascript
if (health.printer.connected) {
  printerStatus.textContent = 'Connected';
  printerStatus.className = 'status-value connected';
} else {
  printerStatus.textContent = 'Disconnected';
  printerStatus.className = 'status-value disconnected';
}
```

**What's shown:**
- ✅ Connection status: "Connected" (green) or "Disconnected" (red)
- ❌ NO printer name/model
- ❌ NO vendor/product ID display
- ❌ NO list of available printers
- ❌ NO printer selection UI

**Auto-refresh:** Status updates every 5 seconds (line 282)

### Q2: What printer information is currently available?
**Location:** `/Users/hammashamzah/Projects/label-printer-server/src/printer/printer-manager.js`

**Available via API:**

| Endpoint | Information | Usage |
|----------|-------------|-------|
| `GET /printers` | Full list of USB devices | ✓ VERIFIED - Line 77-93 in server.js |
| `GET /printers/status` | Current connected printer | ✓ VERIFIED - Line 151-169 in server.js |
| `GET /health` | Basic connection boolean | ✓ VERIFIED - Line 60-72 in server.js |

**Printer Information Structure** (from printer-manager.js listPrinters(), lines 19-57):

```javascript
{
  vendorId: number,           // USB Vendor ID (e.g., 4611 for TSC)
  productId: number,          // USB Product ID (e.g., 2)
  manufacturer: string,       // e.g., "TSC" or "Unknown"
  product: string,            // e.g., "TTP-244 Plus" or "Unknown"
  deviceAddress: number,      // USB device address
  busNumber: number           // USB bus number
}
```

**Printer Status Structure** (from printer-manager.js getStatus(), lines 186-215):

```javascript
{
  connected: boolean,
  ready: boolean,
  status: string,            // "disconnected", "ready", "error"
  device: {                  // Only if connected
    vendorId: number,
    productId: number
  },
  error: string              // Only if status == "error"
}
```

**Note:** The UI currently only uses `health.printer.connected` boolean, ignoring all other available data.

### Q3: Structure of the Electron app and renderer components
**Main Process:** `/Users/hammashamzah/Projects/label-printer-server/src/main.js`

**Architecture:**
- Simple Electron app with **no preload script**
- **No contextIsolation** (line 15: `contextIsolation: false`)
- **nodeIntegration enabled** (line 14: `nodeIntegration: true`)
- Loads single HTML file: `index.html`
- Starts Express API server on port 3000

**Renderer:**
- Single HTML page with inline JavaScript (lines 243-283)
- Uses `fetch()` to call localhost API
- No React, Vue, or other framework
- Pure vanilla JS with manual DOM manipulation

**No separate renderer directory** - everything is in one HTML file.

### Q4: IPC Communication related to printers
**Answer:** ✓ VERIFIED - There is **NO IPC communication** at all.

**Evidence:**
- Searched entire codebase for `ipcRenderer` and `ipcMain` - zero results
- No preload script
- No `ipcRenderer.send()` or `ipcMain.on()` calls

**Communication Pattern:**
```
UI (index.html) 
    ↓ fetch()
Express API (localhost:3000)
    ↓ getPrinterManager()
PrinterManager (singleton)
    ↓ USB library
Hardware Printer
```

The UI is completely decoupled from the main process and communicates only via HTTP.

## Current Printer Discovery Flow

### Listing Printers
**Entry Point:** `GET /printers` (server.js, line 77)

```
1. API endpoint receives GET request
2. Calls printerManager.listPrinters()
3. PrinterManager.listPrinters() (line 19 in printer-manager.js):
   - Calls usb.getDeviceList()
   - Opens each device to read manufacturer/product name
   - Maps to structured object with vendorId, productId, etc.
   - Returns array of all USB devices
4. API returns JSON response
```

### Connecting to Printer
**Entry Point:** `POST /printers/connect` (server.js, line 99)

```
Request body: { vendorId: 4611, productId: 2 }

1. API validates vendorId and productId
2. Calls printerManager.connect({ vendorId, productId })
3. PrinterManager.connect() (line 66 in printer-manager.js):
   - Finds device via usb.findByIds()
   - Opens device
   - Claims interface (interface 0)
   - Finds OUT endpoint
   - Stores references to device, interface, endpoint
4. Returns success response
```

**Current State:** Only one printer can be connected at a time (singleton pattern).

## Architecture Map

```
[Electron Main Process]
        |
        ├─→ [Express API Server :3000]
        |           |
        |           ├─→ [PrinterManager Singleton]
        |           |       └─→ [USB Library] → Hardware
        |           |
        |           └─→ [PrintQueue Singleton]
        |                   └─→ Uses PrinterManager
        |
        └─→ [BrowserWindow]
                └─→ [index.html] (Renderer)
                        ↓ fetch()
                    HTTP to localhost:3000
```

## Key Files

| File | Purpose | Key Exports/Entry Points |
|------|---------|--------------------------|
| `src/main.js` | Electron entry | `createWindow()`, app lifecycle |
| `src/index.html` | UI Dashboard | `refreshStatus()` (JS function) |
| `src/api/server.js` | REST API | `startApiServer()`, all endpoints |
| `src/printer/printer-manager.js` | USB control | `getPrinterManager()`, singleton class |
| `src/printer/print-queue.js` | Queue | `getPrintQueue()`, singleton class |
| `src/printer/tspl-generator.js` | TSPL commands | `generateTSPL()` |
| `src/config/page-configs.js` | Label layouts | `getAllPageConfigs()` |

## Available But Unused Information

The following information is **available from the API** but **not displayed in the UI**:

✓ VERIFIED Available:
- [ ] Printer manufacturer name (e.g., "TSC")
- [ ] Printer product name (e.g., "TTP-244 Plus")  
- [ ] Vendor ID and Product ID
- [ ] Device address and bus number
- [ ] Full list of available printers to choose from
- [ ] Ready status (beyond just connected/disconnected)
- [ ] Error messages when status is "error"

Currently shown:
- [x] Connection status (boolean)
- [x] Queue statistics (pending, processing, completed)

## UI Improvement Opportunities

Based on available data, the UI could be enhanced to show:

1. **Printer Selection Dropdown**
   - Fetch from `GET /printers`
   - Display manufacturer + product name
   - Allow user to select and connect

2. **Connected Printer Details**
   - Show manufacturer: "TSC"
   - Show model: "TTP-244 Plus"
   - Show IDs: "VID:4611 PID:2"
   - Show ready status

3. **Error Display**
   - Show error messages from `status.error` field

4. **Available Printers Panel**
   - List all detected USB devices
   - Visual indication of which is connected
   - One-click connect buttons

## Conventions Discovered

### Naming
- Files: kebab-case (`printer-manager.js`, `page-configs.js`)
- Functions: camelCase (`getPrinterManager`, `listPrinters`)
- Classes: PascalCase (`PrinterManager`)

### Patterns
| Pattern | Usage | Location |
|---------|-------|----------|
| Singleton | Manager instances | `getPrinterManager()`, `getPrintQueue()` |
| Factory functions | Get singleton | `get*()` functions |
| Express middleware | API structure | server.js |
| Callback-based | USB operations | printer-manager.js transfer() |

### Error Handling
- Try-catch blocks with logger.error()
- API returns `{ success: boolean, error: string }` pattern
- USB errors logged but not always surfaced to UI

### Configuration
- No environment variables for API port (hardcoded 3000)
- Page configs in separate module
- Logger uses Winston with file transports

## Testing
- ❌ No test files found
- ❌ No test directory
- ❌ No test framework installed
