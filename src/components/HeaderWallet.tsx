"use client";

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet } from 'lucide-react';
import { UserProfile } from '@/types/profile';
import { SeedAvatar } from '@/components/SeedAvatar';

interface HeaderWalletProps {
  isDarkMode: boolean;
}

function hashStringToUint32(str: string): number {
  // Simple deterministic hash -> uint32
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function DeterministicAvatar({
  seed,
  isDarkMode,
}: {
  seed: string;
  isDarkMode: boolean;
}) {
  const safeSeed = seed.trim() || 'user';
  const s = hashStringToUint32(safeSeed);
  const rand = mulberry32(s);

  const palettes = isDarkMode
    ? [
        ['#39FF14', '#0B3D12'],
        ['#60A5FA', '#0B1B2E'],
        ['#A78BFA', '#1B1236'],
        ['#FCA5A5', '#3B1212'],
        ['#FBBF24', '#3A2A00'],
      ]
    : [
        ['#10B981', '#064E3B'],
        ['#2563EB', '#1E3A8A'],
        ['#7C3AED', '#3B0764'],
        ['#F97316', '#7C2D12'],
        ['#F59E0B', '#4B2A00'],
      ];

  const paletteIndex = Math.floor(rand() * palettes.length) % palettes.length;
  const [bg, accent] = palettes[paletteIndex];

  // Choose between a few shape variants (still text-free)
  const variant = Math.floor(rand() * 5);

  // Precompute some positions
  const dots = Array.from({ length: 6 }).map((_, i) => {
    const x = 8 + rand() * 24;
    const y = 8 + rand() * 24;
    const r = 1.2 + rand() * 2.2;
    const t = i / 5;
    return { x, y, r, t };
  });

  return (
    <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id={`g-${s}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={bg} stopOpacity="1" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.95" />
        </linearGradient>
      </defs>

      <circle cx="20" cy="20" r="18.5" fill={`url(#g-${s})`} />
      <circle cx="20" cy="20" r="18.5" fill="none" stroke={isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'} strokeWidth="1" />

      {variant === 0 && (
        <>
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={isDarkMode ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.65)'} />
          ))}
        </>
      )}

      {variant === 1 && (
        <>
          {dots.map((d, i) => (
            <rect
              key={i}
              x={d.x - d.r}
              y={d.y - d.r}
              width={d.r * 2}
              height={d.r * 2}
              rx={Math.max(1, d.r)}
              fill={isDarkMode ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.65)'}
              transform={`rotate(${(rand() * 60 - 30).toFixed(2)} ${d.x} ${d.y})`}
            />
          ))}
        </>
      )}

      {variant === 2 && (
        <>
          <path
            d={`M ${10 + rand() * 4} ${8 + rand() * 6} C ${18 + rand() * 8} ${4 + rand() * 10}, ${22 + rand() * 8} ${22 + rand() * 8}, ${30 - rand() * 4} ${30 - rand() * 6}`}
            fill="none"
            stroke={isDarkMode ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.65)'}
            strokeWidth="3"
            strokeLinecap="round"
          />
          {dots.slice(0, 4).map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={accent} opacity="0.35" />
          ))}
        </>
      )}

      {variant === 3 && (
        <>
          <polygon
            points={`${12 + rand() * 5},${30 - rand() * 6} ${28 - rand() * 6},${26 - rand() * 6} ${18 + rand() * 6},${10 + rand() * 6}`}
            fill={isDarkMode ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.65)'}
            opacity="0.95"
          />
          {dots.slice(0, 5).map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={accent} opacity="0.4" />
          ))}
        </>
      )}

      {variant === 4 && (
        <>
          {Array.from({ length: 4 }).map((_, i) => {
            const y = 12 + i * 5 + rand() * 1.5;
            return (
              <path
                key={i}
                d={`M ${6} ${y} C ${14} ${y - 3}, ${26} ${y + 3}, ${34} ${y}`}
                fill="none"
                stroke={isDarkMode ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.65)'}
                strokeWidth="2"
                strokeLinecap="round"
              />
            );
          })}
          {dots.slice(0, 3).map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={accent} opacity="0.45" />
          ))}
        </>
      )}
    </svg>
  );
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
    const seed = displayName;

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
              className="w-5 h-5 lg:w-6 lg:h-6 rounded-full overflow-hidden shadow-sm border-2 border-current/10"
            >
              <SeedAvatar seed={seed} isDarkMode={isDarkMode} className="w-full h-full" />
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
