"use client";

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';
import { UserProfile } from '@/types/profile';

interface HeaderWalletProps {
  isDarkMode: boolean;
}

// Generate initials from name
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Generate a gradient color based on address
function getGradientFromAddress(address: string): string {
  // Use last 6 chars of address to generate consistent color
  const hash = address.slice(-6);
  const hue = parseInt(hash, 16) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

export function HeaderWallet({ isDarkMode }: HeaderWalletProps) {
  const { address, isConnected } = useAccount();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (address && isConnected) {
      setIsLoading(true);
      fetch(`/api/profile?address=${address}`)
        .then(res => res.json())
        .then(data => {
          if (data.profile) {
            setProfile(data.profile);
          } else {
            setProfile(null);
          }
        })
        .catch(() => {
          setProfile(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setProfile(null);
    }
  }, [address, isConnected]);

  if (!isConnected) {
    return (
      <div className="scale-90 lg:scale-100">
        <ConnectButton />
      </div>
    );
  }

  // Show profile if available
  if (profile && !isLoading) {
    const displayName = profile.display_name || profile.username || 'User';
    const initials = getInitials(displayName);
    const gradientColor = address ? getGradientFromAddress(address) : '#39FF14';

    return (
      <div 
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className={`flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 rounded text-xs lg:text-sm font-medium cursor-pointer transition-all ${
          isDarkMode 
            ? 'bg-[#39FF14]/10 text-white border border-[#39FF14]/30 hover:bg-[#39FF14]/15' 
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
        }`}>
          {profile.image ? (
            <img 
              src={profile.image} 
              alt={displayName} 
              className="w-5 h-5 lg:w-6 lg:h-6 rounded-full object-cover border-2 border-current/20"
            />
          ) : (
            <div 
              className="w-5 h-5 lg:w-6 lg:h-6 rounded-full flex items-center justify-center text-[10px] lg:text-xs font-bold text-white shadow-sm"
              style={{ backgroundColor: gradientColor }}
            >
              {initials}
            </div>
          )}
          <span className="font-medium">
            {displayName}
          </span>
        </div>
        
        {/* Tooltip with wallet address */}
        {showTooltip && address && (
          <div className={`absolute right-0 top-full mt-2 px-3 py-2 rounded-lg text-xs font-mono whitespace-nowrap z-50 shadow-lg ${
            isDarkMode 
              ? 'bg-gray-900 text-white border border-gray-700' 
              : 'bg-white text-gray-900 border border-gray-200'
          }`}>
            {address}
            <div className={`absolute -top-1 right-4 w-2 h-2 rotate-45 ${
              isDarkMode ? 'bg-gray-900 border-l border-t border-gray-700' : 'bg-white border-l border-t border-gray-200'
            }`}></div>
          </div>
        )}
      </div>
    );
  }

  // Fallback to wallet address
  return (
    <div className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-3 py-1.5 rounded text-xs lg:text-sm font-medium ${
      isDarkMode 
        ? 'bg-[#39FF14]/10 text-white border border-[#39FF14]/30' 
        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    }`}>
      <Wallet size={12} className="lg:w-3.5 lg:h-3.5" />
      <span className="font-mono text-xs lg:text-sm">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
    </div>
  );
}
