const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory in user data folder (works in packaged app)
// In production: %APPDATA%/label-printer-server/logs
// In development: ./logs
const getLogsDir = () => {
  // Check if running inside asar (packaged app)
  const isPackaged = __dirname.includes('app.asar');

  if (isPackaged) {
    // Use electron's app module for user data path
    try {
      const { app } = require('electron');
      return path.join(app.getPath('userData'), 'logs');
    } catch {
      // Fallback: use standard AppData location on Windows
      const appData = process.env.APPDATA || process.env.HOME;
      return path.join(appData, 'label-printer-server', 'logs');
    }
  }
  return path.join(__dirname, '../../logs');
};

const logsDir = getLogsDir();
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'label-printer-server' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ level, message, timestamp, ...metadata }) => {
            let msg = `${timestamp} [${level}]: ${message}`;
            if (Object.keys(metadata).length > 0 && metadata.service) {
              delete metadata.service;
              if (Object.keys(metadata).length > 0) {
                msg += ` ${JSON.stringify(metadata)}`;
              }
            }
            return msg;
          }
        )
      )
    }),
    // Write all logs to file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log')
    })
  ]
});

module.exports = { logger };
