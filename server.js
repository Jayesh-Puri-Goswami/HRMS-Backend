const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Initialize log manager
const { initLogManager } = require('./config/logger');

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err);
  process.exit(1);
});

dotenv.config({ path: './.env' });

const { app, setupCronJobs } = require('./app');

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
  })
  .then(async () => {
    console.log('DB connection successful!');
    
    // Initialize log manager
    initLogManager();
    
    // Now safely call the setupCronJobs
    setupCronJobs();
  });

const port = process.env.PORT || 8084;

const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Log directory: ${path.join(__dirname, 'logs')}`);
});

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});
