import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Create Supabase client with service role key for server-side operations
export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Create public client for user authentication
export const supabasePublic = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY
);

// Test database connection
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    // In development, just test if we can create a client
    if (process.env.NODE_ENV === 'development') {
      // Simple connectivity test - check if we can reach Supabase
      const { data, error } = await supabase
        .from('reports')
        .select('count')
        .limit(1);
      
      if (error) {
        console.warn('⚠️  Database connection test failed (development mode):', error.message);
        console.log('🔄 Server will continue running for development...');
        return true; // Allow server to start in development even if DB fails
      }
      
      console.log('✅ Database connection successful');
      return true;
    } else {
      // In production, require successful database connection
      const { data, error } = await supabase
        .from('reports')
        .select('count')
        .limit(1);
      
      if (error) {
        console.error('Database connection test failed:', error);
        return false;
      }
      
      console.log('✅ Database connection successful');
      return true;
    }
  } catch (error) {
    console.error('Database connection test error:', error);
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Server will continue running for development...');
      return true;
    }
    return false;
  }
};