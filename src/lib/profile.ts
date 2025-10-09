import { createClient } from '@supabase/supabase-js';
import { UserMarketData } from '@/types/profile';

// Supabase client
const supabase = createClient(
  `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID}.supabase.co`,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getUserMarketsFromSupabase(marketIds: string[]): Promise<UserMarketData[]> {
  if (!marketIds.length) return [];

  try {
    const { data, error } = await supabase
      .from('market')
      .select('*')
      .in('market_id', marketIds);

    if (error) {
      console.error('Error fetching user markets:', error);
      return [];
    }

    return data?.map(market => ({
      marketId: market.market_id,
      title: market.title || 'Untitled Market',
      description: market.description || '',
      image: market.image || '',
      creator: market.creator,
      type: market.type || 'linear',
      token: market.token || '',
      stakeend: market.stakeend || '',
      endtime: market.endtime || '',
      state: market.state || 0
    })) || [];
  } catch (error) {
    console.error('Error in getUserMarketsFromSupabase:', error);
    return [];
  }
}

export async function getUserProfile(address: string) {
  try {
    const response = await fetch(`/api/profile?address=${address}`);
    const data = await response.json();
    
    if (response.ok) {
      return data.profile;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

export async function createUserProfile(profileData: {
  address: string;
  username?: string;
  display_name?: string;
  bio?: string;
  image?: string;
}) {
  try {
    const response = await fetch('/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });

    const data = await response.json();
    
    if (response.ok) {
      return data.profile;
    }
    throw new Error(data.error || 'Failed to create profile');
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
}

export async function updateUserProfile(profileData: {
  address: string;
  username?: string;
  display_name?: string;
  bio?: string;
  image?: string;
}) {
  try {
    const response = await fetch('/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });

    const data = await response.json();
    
    if (response.ok) {
      return data.profile;
    }
    throw new Error(data.error || 'Failed to update profile');
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

export async function uploadProfileImage(file: File, address: string) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('address', address);

    const response = await fetch('/api/profile/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    
    if (response.ok) {
      return data;
    }
    throw new Error(data.error || 'Failed to upload image');
  } catch (error) {
    console.error('Error uploading profile image:', error);
    throw error;
  }
}
