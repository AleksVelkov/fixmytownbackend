-- Add password_hash column to users table
-- Run this in your Supabase SQL editor

ALTER TABLE users 
ADD COLUMN password_hash TEXT;

-- Create an index on email for faster lookups (if not already exists)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create an index on password_hash for faster authentication
CREATE INDEX IF NOT EXISTS idx_users_password_hash ON users(password_hash);

-- Optional: Create a constraint to ensure either google_id OR password_hash is present
-- ALTER TABLE users 
-- ADD CONSTRAINT check_auth_method 
-- CHECK (google_id IS NOT NULL OR password_hash IS NOT NULL);

