const path = require('path');
const fs = require('fs');
const express = require('express');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const cors = require('cors');

const AppError = require('./utills/appError');
const GlobalError = require('./utills/errorController');

// Routes
const AdminRoutes = require('./routes/AdminRoutes');
const EmployeeRoutes = require('./routes/EmployeeRoutes');
const NotificationRoutes = require('./routes/notificationRouter');
const contactRoutes = require('./userController/main.Router');
const cronJob = require('./controller/attandanceController');
const payrollCronJob = require('./controller/payrollController');

const Shift = require('./model/shift.model');

// Start express app
const app = express();

app.enable('trust proxy');

app.use(cors());

app.options('*', cors());

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

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

app.use(helmet());

// const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });
// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else if (process.env.NODE_ENV === 'production') {
  app.use(morgan('dev'));
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(cookieParser());

app.use(mongoSanitize());

app.use(xss());

app.use(compression());

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();

  next();
});

app.use(
  '/csl/v1',
  contactRoutes,
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
    // cronJob.handleEmailAlert(morningShift._id, '30 7 * * *');
    // cronJob.handleEmailAlert(generalShift._id, '30 9 * * *');
    // cronJob.handleEmailAlert(eveningShift._id, '30 15 * * *');

    // Mark Absent
    // cronJob.handleAbsentMarking(morningShift._id, '00 8 * * *');
    // cronJob.handleAbsentMarking(generalShift._id, '00 11 * * *');
    // cronJob.handleAbsentMarking(eveningShift._id, '00 17 * * *');



    console.log('✅ Cron jobs set up successfully!');
  } catch (err) {
    console.error('❌ Failed to setup cron jobs:', err);
  }
}

cronJob.autoCheckOutEmployees();


// setInterval(() => {
//   cronJob.handleAbsentMarking('Morning', '*/1 * * * *');
// }, 5000);

// Salary Generate Cron
payrollCronJob.generateEmployeeSalaryCron();

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(GlobalError);

module.exports = { app, setupCronJobs };
