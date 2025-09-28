import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env, isProduction } from '@/config/env';
import { testDatabaseConnection } from '@/config/database';
import { apiLimiter } from '@/middleware/rateLimiting';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';

// Import routes
import authRoutes from '@/routes/auth';
import reportRoutes from '@/routes/reports';
import userRoutes from '@/routes/users';

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: env.ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api/', apiLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Reports API Server',
    version: '1.0.0',
    environment: env.NODE_ENV,
    endpoints: {
      auth: '/api/auth',
      reports: '/api/reports',
      users: '/api/users',
      health: '/health'
    }
  });
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database');
      process.exit(1);
    }

    // Start the server
    app.listen(env.PORT, () => {
      console.log(`🚀 Server running on port ${env.PORT}`);
      console.log(`📍 Environment: ${env.NODE_ENV}`);
      console.log(`🔗 API Base URL: ${env.API_BASE_URL}`);
      console.log(`📚 API Documentation: ${env.API_BASE_URL}/`);
      
      if (!isProduction) {
        console.log(`🔧 Health Check: http://localhost:${env.PORT}/health`);
        console.log(`🔐 Auth Endpoints: http://localhost:${env.PORT}/api/auth`);
        console.log(`📊 Reports Endpoints: http://localhost:${env.PORT}/api/reports`);
        console.log(`👥 Users Endpoints: http://localhost:${env.PORT}/api/users`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();