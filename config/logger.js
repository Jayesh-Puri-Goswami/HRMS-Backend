const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logDirectory = path.join(__dirname, '../logs');
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

// Simple file streams for logging
const accessLogStream = fs.createWriteStream(
  path.join(logDirectory, 'access.log'),
  { flags: 'a' }
);

const errorLogStream = fs.createWriteStream(
  path.join(logDirectory, 'error.log'),
  { flags: 'a' }
);

// Custom token for request body size
morgan.token('body-size', (req) => {
  return req.body ? JSON.stringify(req.body).length : 0;
});

// Custom token for response time in milliseconds
morgan.token('response-time-ms', (req, res) => {
  if (!res._header || !req._startAt) return '';
  const diff = process.hrtime(req._startAt);
  const ms = diff[0] * 1e3 + diff[1] * 1e-6;
  return ms.toFixed(2);
});

// Custom format for detailed logging
const detailedFormat = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time-ms ms :body-size bytes';

// Custom format for production (less verbose)
const productionFormat = ':remote-addr - :method :url :status :res[content-length] - :response-time-ms ms';

// Development format
const developmentFormat = ':method :url :status :res[content-length] - :response-time-ms ms';

// Error logging middleware
const errorLogger = (err, req, res, next) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    status: res.statusCode,
    error: err.message,
    stack: err.stack,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body
  };

  errorLogStream.write(JSON.stringify(errorLog) + '\n');
  next(err);
};

// Security logging middleware
const securityLogger = (req, res, next) => {
  // Log security events
  if (req.securityEvent) {
    const securityLog = {
      timestamp: new Date().toISOString(),
      event: req.securityEvent,
      ip: req.ip,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent')
    };

    errorLogStream.write(`SECURITY: ${JSON.stringify(securityLog)}\n`);
  }

  next();
};

// Simple log rotation function
const rotateLogs = () => {
  const files = ['access.log', 'error.log'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  files.forEach(filename => {
    const filePath = path.join(logDirectory, filename);
    
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      
      if (stats.size > maxSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const newFilename = `${filename.replace('.log', '')}-${timestamp}.log`;
        const newFilePath = path.join(logDirectory, newFilename);
        
        // Rename the current log file
        fs.renameSync(filePath, newFilePath);
        
        // Create a new empty log file
        fs.writeFileSync(filePath, '');
        
        console.log(`Log file rotated: ${filename} -> ${newFilename}`);
      }
    }
  });
};

// Clean up old log files (keep only last 30 files)
const cleanupOldLogs = () => {
  try {
    const files = fs.readdirSync(logDirectory);
    const logFiles = files.filter(file => file.endsWith('.log'));
    
    // Sort files by modification time
    const sortedFiles = logFiles
      .map(file => ({
        name: file,
        path: path.join(logDirectory, file),
        mtime: fs.statSync(path.join(logDirectory, file)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    // Remove files beyond the limit (keep 30 files)
    if (sortedFiles.length > 30) {
      const filesToDelete = sortedFiles.slice(30);
      
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        console.log(`Deleted old log file: ${file.name}`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up old logs:', error);
  }
};

// Get log statistics
const getLogStats = () => {
  try {
    const files = fs.readdirSync(logDirectory);
    const logFiles = files.filter(file => file.endsWith('.log'));
    
    let totalSize = 0;
    let fileCount = 0;
    
    for (const file of logFiles) {
      const filePath = path.join(logDirectory, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
      fileCount++;
    }
    
    return {
      totalFiles: fileCount,
      totalSize: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      files: logFiles
    };
  } catch (error) {
    console.error('Error getting log stats:', error);
    return null;
  }
};

// Initialize log management
const initLogManager = () => {
  try {
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDirectory)) {
      fs.mkdirSync(logDirectory, { recursive: true });
    }
    
    // Set up periodic cleanup (daily)
    setInterval(() => {
      rotateLogs();
      cleanupOldLogs();
    }, 24 * 60 * 60 * 1000); // Run daily
    
    console.log('Log manager initialized successfully');
  } catch (error) {
    console.error('Error initializing log manager:', error);
  }
};

module.exports = {
  accessLogStream,
  errorLogStream,
  detailedFormat,
  productionFormat,
  developmentFormat,
  errorLogger,
  securityLogger,
  rotateLogs,
  cleanupOldLogs,
  getLogStats,
  initLogManager
}; 