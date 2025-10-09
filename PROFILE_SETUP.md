# Profile System Setup Guide

This guide will help you set up the user profile system for your P2P application.

## Prerequisites

- Supabase project configured
- Environment variables set up
- Analytics contract deployed

## Setup Steps

### 1. Database Setup

Run the SQL commands in `setup-profile.sql` in your Supabase SQL editor:

```sql
-- This will create:
-- - users table with profile fields
-- - Storage bucket for user images
-- - RLS policies for security
-- - Indexes for performance
```

### 2. Environment Variables

Add these to your `.env.local` file:

```env
# Analytics contract address (you'll need to deploy this)
NEXT_PUBLIC_ANALYTICS_CONTRACT_ADDRESS=0x...

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Features Included

#### Profile Management
- ✅ Create and edit user profiles
- ✅ Username, display name, bio fields
- ✅ Profile image upload to Supabase storage
- ✅ Unique username validation

#### Analytics Integration
- ✅ Display user trading statistics from contract
- ✅ Win rate calculation
- ✅ Total stakes, winnings, markets created
- ✅ User market history

#### UI Components
- ✅ Modern, responsive profile page
- ✅ Edit mode with form validation
- ✅ Image upload with preview
- ✅ Analytics dashboard
- ✅ User markets display

### 4. API Endpoints

- `GET /api/profile?address=0x...` - Get user profile
- `POST /api/profile` - Create new profile
- `PUT /api/profile` - Update existing profile
- `POST /api/profile/upload` - Upload profile image
- `DELETE /api/profile/upload?path=...&address=0x...` - Delete image

### 5. Navigation

The profile page is accessible via:
- Sidebar navigation (Profile link)
- Direct URL: `/profile`

### 6. Security Features

- Row Level Security (RLS) enabled
- Image upload validation (type, size)
- Username uniqueness enforcement
- Address-based profile ownership

### 7. Next Steps

1. Deploy the analytics contract and add its address to env
2. Run the SQL setup in Supabase
3. Test the profile creation and editing
4. Customize the UI as needed

## File Structure

```
src/
├── app/
│   ├── profile/
│   │   └── page.tsx              # Main profile page
│   └── api/
│       └── profile/
│           ├── route.ts          # Profile CRUD operations
│           └── upload/
│               └── route.ts      # Image upload/delete
├── types/
│   └── profile.ts                # TypeScript interfaces
└── lib/
    └── profile.ts                # Utility functions
```

## Usage

1. Connect wallet
2. Navigate to Profile page
3. Create profile with username, display name, bio
4. Upload profile image
5. View analytics and market history

The system automatically loads user data from both Supabase (for speed) and the analytics contract (for real-time stats).
