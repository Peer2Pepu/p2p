-- Migration to add Oracle and UMA fields to the market table
-- Run this in your Supabase SQL editor

-- First, ensure the market table exists (create it if it doesn't)
CREATE TABLE IF NOT EXISTS market (
    market_id TEXT PRIMARY KEY,
    ipfs TEXT,
    image TEXT,
    stakeend TIMESTAMP WITH TIME ZONE,
    endtime TIMESTAMP WITH TIME ZONE,
    creator TEXT,
    type TEXT, -- 'multi' or 'linear'
    token TEXT,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns for market type and oracle integration
-- Market type: 'PRICE_FEED' or 'UMA_MANUAL'
ALTER TABLE market 
ADD COLUMN IF NOT EXISTS market_type TEXT DEFAULT 'UMA_MANUAL';

-- Price feed address (for PRICE_FEED markets)
ALTER TABLE market 
ADD COLUMN IF NOT EXISTS price_feed TEXT;

-- Price threshold (for PRICE_FEED markets, stored as numeric string)
ALTER TABLE market 
ADD COLUMN IF NOT EXISTS price_threshold TEXT;

-- UMA assertion ID (bytes32 as hex string)
ALTER TABLE market 
ADD COLUMN IF NOT EXISTS uma_assertion_id TEXT;

-- Whether UMA assertion has been made
ALTER TABLE market 
ADD COLUMN IF NOT EXISTS uma_assertion_made BOOLEAN DEFAULT FALSE;

-- Add index on market_type for faster queries
CREATE INDEX IF NOT EXISTS idx_market_market_type ON market(market_type);

-- Add index on uma_assertion_made for faster queries
CREATE INDEX IF NOT EXISTS idx_market_uma_assertion_made ON market(uma_assertion_made);

-- Add index on creator for faster lookups
CREATE INDEX IF NOT EXISTS idx_market_creator ON market(creator);

-- Add index on endtime for faster queries on ended markets
CREATE INDEX IF NOT EXISTS idx_market_endtime ON market(endtime);

-- Add comment to document the new fields
COMMENT ON COLUMN market.market_type IS 'Market type: PRICE_FEED (auto-resolves from price) or UMA_MANUAL (requires UMA assertion)';
COMMENT ON COLUMN market.price_feed IS 'Price feed contract address (for PRICE_FEED markets only)';
COMMENT ON COLUMN market.price_threshold IS 'Price threshold value as string (for PRICE_FEED markets only)';
COMMENT ON COLUMN market.uma_assertion_id IS 'UMA Optimistic Oracle assertion ID (hex string, for UMA_MANUAL markets only)';
COMMENT ON COLUMN market.uma_assertion_made IS 'Whether a UMA assertion has been made for this market';

-- Enable Row Level Security (RLS) for the market table
ALTER TABLE market ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read (SELECT) all markets
CREATE POLICY "Anyone can view markets" ON market
    FOR SELECT USING (true);

-- Policy: Only service role can insert markets (via bot/server)
-- Note: This requires service role key, not anon key
-- The bot should use SUPABASE_SERVICE_ROLE_KEY, not SUPABASE_ANON_KEY
CREATE POLICY "Service role can insert markets" ON market
    FOR INSERT WITH CHECK (true);

-- Policy: Only service role can update markets
CREATE POLICY "Service role can update markets" ON market
    FOR UPDATE USING (true);

-- Policy: Only service role can delete markets (if needed)
CREATE POLICY "Service role can delete markets" ON market
    FOR DELETE USING (true);
