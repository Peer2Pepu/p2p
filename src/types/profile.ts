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
  /** Winning claims tracked (native + P2P token markets only). */
  totalStakesWon: bigint;
  totalStakesLost: bigint;
  /** Legacy field; new claims use totalWinningsNative / totalWinningsP2PToken. */
  totalWinnings: bigint;
  totalLosses: bigint;
  totalSupportDonated: bigint;
  marketsCreated: bigint;
  marketsWon: bigint;
  marketsLost: bigint;
  favoriteOption: bigint;
  lastActivity: bigint;
  totalStakesWonNative: bigint;
  totalStakesWonP2PToken: bigint;
  totalWinningsNative: bigint;
  totalWinningsP2PToken: bigint;
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
