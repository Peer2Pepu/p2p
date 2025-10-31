import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CreateProfileData, UpdateProfileData } from '@/types/profile';

// Supabase client
const supabase = createClient(
  `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID}.supabase.co`,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Fetch user profile by address
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('address', address.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        // Check if it's a network error
        if (error.message?.includes('fetch failed') || error.message?.includes('ENOTFOUND')) {
          console.error('Network error connecting to Supabase:', error.message);
          return NextResponse.json(
            { 
              error: 'Network error: Unable to connect to database. Please check your internet connection.',
              profile: null 
            },
            { status: 503 } // Service Unavailable
          );
        }
        
        console.error('Supabase error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch profile' },
          { status: 500 }
        );
      }

      return NextResponse.json({ profile: data || null });
    } catch (supabaseError: any) {
      // Handle network errors specifically
      if (supabaseError?.message?.includes('fetch failed') || 
          supabaseError?.code === 'ENOTFOUND' ||
          supabaseError?.cause?.code === 'ENOTFOUND') {
        console.error('Network connectivity issue:', supabaseError.message);
        return NextResponse.json(
          { 
            error: 'Network error: Unable to connect to database. Please check your internet connection.',
            profile: null 
          },
          { status: 503 }
        );
      }
      throw supabaseError; // Re-throw if it's not a network error
    }
  } catch (error: any) {
    console.error('API error:', error);
    
    // Check if it's a network error
    if (error?.message?.includes('fetch failed') || 
        error?.code === 'ENOTFOUND' ||
        error?.cause?.code === 'ENOTFOUND') {
      return NextResponse.json(
        { 
          error: 'Network error: Unable to connect to service. Please check your internet connection.',
          profile: null 
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new user profile
export async function POST(request: NextRequest) {
  try {
    const body: CreateProfileData = await request.json();
    const { address, username, display_name, bio, image } = body;

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('users')
      .select('id')
      .eq('address', address.toLowerCase())
      .single();

    if (existingProfile) {
      return NextResponse.json(
        { error: 'Profile already exists for this address' },
        { status: 409 }
      );
    }

    // Check if username is taken (if provided)
    if (username) {
      const { data: existingUsername } = await supabase
        .from('users')
        .select('id')
        .eq('username', username.toLowerCase())
        .single();

      if (existingUsername) {
        return NextResponse.json(
          { error: 'Username is already taken' },
          { status: 409 }
        );
      }
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        address: address.toLowerCase(),
        username: username?.toLowerCase(),
        display_name,
        bio,
        image
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to create profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile: data }, { status: 201 });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update user profile
export async function PUT(request: NextRequest) {
  try {
    const body: UpdateProfileData & { address: string } = await request.json();
    const { address, username, display_name, bio, image } = body;

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    // Check if username is taken by another user (if provided)
    if (username) {
      const { data: existingUsername } = await supabase
        .from('users')
        .select('id, address')
        .eq('username', username.toLowerCase())
        .single();

      if (existingUsername && existingUsername.address !== address.toLowerCase()) {
        return NextResponse.json(
          { error: 'Username is already taken' },
          { status: 409 }
        );
      }
    }

    const updateData: any = {};
    if (username !== undefined) updateData.username = username.toLowerCase();
    if (display_name !== undefined) updateData.display_name = display_name;
    if (bio !== undefined) updateData.bio = bio;
    if (image !== undefined) updateData.image = image;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('address', address.toLowerCase())
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
