import rateLimit from 'express-rate-limit';
import { env } from '@/config/env';

// General API rate limiting
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS, // 15 minutes by default
  max: env.RATE_LIMIT_MAX_REQUESTS, // 100 requests per window by default
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for report creation
export const createReportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 reports per hour
  message: {
    success: false,
    error: 'Too many reports created, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for voting
export const voteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 votes per minute
  message: {
    success: false,
    error: 'Too many votes, please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false,
});