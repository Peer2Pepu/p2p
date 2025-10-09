export interface UserProfile {
  id: string;
  address: string;
  username?: string;
  display_name?: string;
  bio?: string;
  image?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProfileData {
  address: string;
  username?: string;
  display_name?: string;
  bio?: string;
  image?: string;
}

export interface UpdateProfileData {
  username?: string;
  display_name?: string;
  bio?: string;
  image?: string;
}

// Analytics data from contract
export interface UserAnalytics {
  totalStakesPlaced: bigint;
  totalStakesWon: bigint;
  totalStakesLost: bigint;
  totalWinnings: bigint;
  totalLosses: bigint;
  totalSupportDonated: bigint;
  marketsCreated: bigint;
  marketsWon: bigint;
  marketsLost: bigint;
  favoriteOption: bigint;
  lastActivity: bigint;
}

export interface UserMarketData {
  marketId: string;
  title: string;
  description: string;
  image: string;
  creator: string;
  type: 'multi' | 'linear';
  token: string;
  stakeend: string;
  endtime: string;
  state: number;
  totalVolume?: bigint;
  totalStakers?: bigint;
  totalSupporters?: bigint;
}
