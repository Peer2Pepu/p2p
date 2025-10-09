-- Run this in your Supabase SQL editor to set up the profile system

-- Create users table for profile management
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    address TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    display_name TEXT,
    bio TEXT,
    image TEXT, -- URL to image in Supabase storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_address ON users(address);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all profiles" ON users
    FOR SELECT USING (true);

CREATE POLICY "Users can create their own profile" ON users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for user images (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('user-images', 'user-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for user images
CREATE POLICY "Users can upload their own images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'user-images');

CREATE POLICY "Users can update their own images" ON storage.objects
    FOR UPDATE USING (bucket_id = 'user-images');

CREATE POLICY "Users can delete their own images" ON storage.objects
    FOR DELETE USING (bucket_id = 'user-images');

CREATE POLICY "Anyone can view user images" ON storage.objects
    FOR SELECT USING (bucket_id = 'user-images');
