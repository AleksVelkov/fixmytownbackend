import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment schema validation
const envSchema = z.object({
  // Server
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_BASE_URL: z.string().url(),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  
  // Digital Ocean Spaces
  DO_SPACES_ENDPOINT: z.string().url(),
  DO_SPACES_BUCKET: z.string().min(1),
  DO_SPACES_REGION: z.string().min(1),
  DO_SPACES_ACCESS_KEY: z.string().min(1),
  DO_SPACES_SECRET_KEY: z.string().min(1),
  
  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  
  // CORS
  ALLOWED_ORIGINS: z.string().transform(str => str.split(',')),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),
  
  // File Upload
  MAX_FILE_SIZE: z.string().default('10485760').transform(Number),
  ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/webp').transform(str => str.split(',')),
});

// Validate and export environment variables
export const env = envSchema.parse(process.env);

// Helper function to check if we're in production
export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';