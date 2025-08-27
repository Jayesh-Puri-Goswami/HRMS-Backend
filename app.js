const path = require('path');
const fs = require('fs');
const express = require('express');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const cors = require('cors');

// Import configurations
// const { 
//   accessLogStream, 
//   errorLogStream, 
//   detailedFormat, 
//   productionFormat, 
//   developmentFormat, 
//   errorLogger, 
//   securityLogger 
// } = require('./config/logger');

const { 
  generalLimiter, 
  authLimiter, 
  apiLimiter, 
  uploadLimiter, 
  loginLimiter, 
  adminLimiter 
} = require('./config/rateLimiter');

// const securityConfig = require('./config/security');

const AppError = require('./utills/appError');
const GlobalError = require('./utills/errorController');

// Routes
const AdminRoutes = require('./routes/AdminRoutes');
const EmployeeRoutes = require('./routes/EmployeeRoutes');
const NotificationRoutes = require('./routes/notificationRouter');
const cronJob = require('./controller/attandanceController');
const payrollCronJob = require('./controller/payrollController');

const Shift = require('./model/shift.model');

// Start express app
const app = express();

app.enable('trust proxy');

// Force process timezone to IST at runtime (safety net)
process.env.TZ = 'Asia/Kolkata';

// Security middleware (apply early)
// app.use(securityConfig.helmet);
// app.use(securityConfig.additionalHeaders);
// app.use(securityConfig.validateRequest);
// app.use(securityConfig.requestSizeLimiter);

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

app.options('*', cors());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Security logger middleware
// app.use(securityLogger);

const angularBuildPath = path.join(__dirname, 'dist');
app.use(express.static(angularBuildPath));

app.get('/*', (req, res) => res.sendFile(path.join(__dirname)));

app.get('/csl/users/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, 'public', 'img', 'users', filename);
  res.sendFile(filePath);
});

app.get('/csl/employee-documents/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(
    __dirname,
    'public',
    'employee-documents',
    filename
  );
  res.sendFile(filePath);
});

app.get('/csl/policies/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, 'public', 'policies', filename);
  res.sendFile(filePath);
});

app.get('/csl/agreements/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, 'public', 'agreements', filename);
  res.sendFile(filePath);
});

// // Enhanced logging configuration
// if (process.env.NODE_ENV === 'development') {
//   // Development: Console logging
//   app.use(morgan(developmentFormat));
//   // Also log to file for debugging
//   app.use(morgan(detailedFormat, { stream: accessLogStream }));
// } else if (process.env.NODE_ENV === 'production') {
//   // Production: File logging only
//   app.use(morgan(productionFormat, { stream: accessLogStream }));
//   // Error logging
//   app.use(morgan(productionFormat, { 
//     stream: errorLogStream,
//     skip: (req, res) => res.statusCode < 400 
//   }));
// }

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cookieParser());

// Security middleware
app.use(mongoSanitize());
app.use(xss());

// Compression middleware
app.use(compression());

// Request timestamp middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// Apply rate limiting to different route groups
// app.use('/csl/v1/auth', loginLimiter, authLimiter); // Authentication routes
// app.use('/csl/v1/admin', adminLimiter, apiLimiter); // Admin routes
// app.use('/csl/v1/upload', uploadLimiter); // File upload routes
// app.use('/csl/v1', generalLimiter, apiLimiter); // General API routes

// Apply routes with rate limiting
app.use(
  '/csl/v1',
  AdminRoutes,
  EmployeeRoutes,
  NotificationRoutes
);

// UpdatePersonnelLeave
cronJob.updatePersonnelLeave();
// ResatCasualLeave
cronJob.resetCasualLeave();
// ResetMedicalLeave
cronJob.resetMedicalLeave();
//resatLWPLeave
cronJob.resatLWPlLeave();



async function setupCronJobs() {
  try {
    const morningShift = await Shift.findOne({
      name: { $regex: /^Morning Shift$/i },
    });
    const generalShift = await Shift.findOne({
      name: { $regex: /^General Shift$/i },
    });
    const eveningShift = await Shift.findOne({
      name: { $regex: /^Evening Shift$/i },
    });

    

    if (!morningShift || !generalShift || !eveningShift) {
      console.error('Error: One or more shifts not found in the database.');
      return;
    }

    // Email alerts
    cronJob.handleEmailAlert(morningShift._id, '30 7 * * *');
    cronJob.handleEmailAlert(generalShift._id, '30 9 * * *');
    cronJob.handleEmailAlert(eveningShift._id, '30 15 * * *');

    // Mark Not In Office
    cronJob.handleNotInOfficeMarking(morningShift._id, '00 8 * * *');
    cronJob.handleNotInOfficeMarking(generalShift._id, '00 11 * * *');
    cronJob.handleNotInOfficeMarking(eveningShift._id, '00 17 * * *');

    // Test Cron
    // cronJob.handleNotInOfficeMarking(morningShift._id, '* * * * *');
    // cronJob.handleNotInOfficeMarking(generalShift._id, '* * * * *');
    // cronJob.handleNotInOfficeMarking(eveningShift._id, '* * * * *');

    console.log(' Cron jobs set up successfully!');
  } catch (err) {
    console.error(' Failed to setup cron jobs:', err);
  }
}

cronJob.autoCheckOutEmployees();



// Salary Generate Cron
payrollCronJob.generateEmployeeSalaryCron();

// 404 handler
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Error logging middleware
// app.use(errorLogger);

// Global error handler
app.use(GlobalError);

module.exports = { app, setupCronJobs };
