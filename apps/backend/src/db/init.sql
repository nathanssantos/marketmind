-- MarketMind Database Initialization Script
-- PostgreSQL 17 + TimescaleDB 2.23.1

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create indexes for performance
-- Note: Drizzle ORM will create the main tables via migrations
-- This script only sets up extensions and any manual optimizations

-- Set timezone to UTC
SET timezone = 'UTC';

-- Configure TimescaleDB settings for optimal performance
ALTER DATABASE marketmind SET timescaledb.max_background_workers = 8;

-- Log successful initialization
DO $$
BEGIN
  RAISE NOTICE 'MarketMind database initialized successfully';
  RAISE NOTICE 'TimescaleDB version: %', extversion FROM pg_extension WHERE extname = 'timescaledb';
END $$;
