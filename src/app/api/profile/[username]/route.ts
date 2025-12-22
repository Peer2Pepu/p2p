import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase client
const supabase = createClient(
  `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID}.supabase.co`,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Fetch user profile by username
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    if (!username) {
      return NextResponse.json(
        { error: 'Username parameter is required' },
        { status: 400 }
      );
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        if (error.message?.includes('fetch failed') || error.message?.includes('ENOTFOUND')) {
          console.error('Network error connecting to Supabase:', error.message);
          return NextResponse.json(
            { 
              error: 'Network error: Unable to connect to database. Please check your internet connection.',
              profile: null 
            },
            { status: 503 }
          );
        }
        
        console.error('Supabase error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch profile' },
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
    } catch (supabaseError: any) {
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
      throw supabaseError;
    }
  } catch (error: any) {
    console.error('API error:', error);
    
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

