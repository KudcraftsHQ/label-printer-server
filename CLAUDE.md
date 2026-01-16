# Label Printer Server

Electron-based label printer server with TSPL support for thermal printers.

## Quick Start

```bash
bun install
bun run start
```

## API Server

- **Default Port**: 9632
- **Health Check**: `GET http://localhost:9632/health`

## Versioning

### Semantic Versioning (MAJOR.MINOR.PATCH)

Version is stored in `package.json` only (single source of truth).

| Change Type | Bump | Example |
|-------------|------|---------|
| Bug fix, printer compatibility | PATCH | 1.0.0 → 1.0.1 |
| New feature, new API endpoint | MINOR | 1.0.1 → 1.1.0 |
| Breaking API change, major rewrite | MAJOR | 1.1.0 → 2.0.0 |

### Release Workflow

**Every push to main must include a version tag to trigger a release.**

```bash
# 1. Bump version (creates commit + tag automatically)
npm version patch   # Bug fix: 1.0.0 → 1.0.1
npm version minor   # New feature: 1.0.1 → 1.1.0
npm version major   # Breaking change: 1.1.0 → 2.0.0

# 2. Push commit and tag together
git push && git push --tags
```

This triggers GitHub Actions which:
1. Builds Windows installer (`Label-Printer-Server-Setup-{version}.exe`)
2. Creates GitHub Release with the installer
3. Enables auto-update for existing installations

### Manual Version Tag (if needed)

```bash
# If you already committed without tagging:
git tag v1.0.1
git push --tags
```

## Build

```bash
# Windows installer
bun run build:win

# Output: dist/Label-Printer-Server-Setup-{version}.exe
```

## Project Structure

```
src/
├── main.js              # Electron main process
├── index.html           # Dashboard UI
├── api/
│   └── server.js        # Express REST API (port 9632)
├── config/
│   ├── page-configs.js  # Label layout configurations
│   └── settings.js      # User settings management
├── printer/
│   ├── printer-manager.js  # USB printer control
│   ├── print-queue.js      # Job queue management
│   └── tspl-generator.js   # TSPL command generation
├── utils/
│   └── logger.js        # Winston logger
└── wizard/
    ├── wizard.html      # Setup wizard UI
    └── wizard.js        # Wizard logic
```

## Configuration

User settings stored at:
- Windows: `%APPDATA%/label-printer-server/config.json`
- macOS: `~/Library/Application Support/label-printer-server/config.json`

### Config Schema

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

## Auto-Updater

- Checks GitHub releases on app start
- Downloads updates silently in background
- Installs on app quit (silent update on quit)
- Uses electron-updater with GitHub releases as update server

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check + status |
| GET | /printers | List USB printers |
| POST | /printers/connect | Connect to printer |
| POST | /printers/disconnect | Disconnect printer |
| GET | /printers/status | Printer status |
| GET | /configs | Label configurations |
| POST | /print | Queue print job |
| POST | /print/custom | Custom TSPL job |
| GET | /jobs | List jobs |
| GET | /jobs/:id | Get job |
| DELETE | /jobs/:id | Cancel/delete job |
| GET | /queue/stats | Queue statistics |
| POST | /queue/clear | Clear completed jobs |
