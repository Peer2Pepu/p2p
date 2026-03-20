"use client";

import React from 'react';

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
  // Deterministic RNG for stable SVG variants/colors
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function SeedAvatar({
  seed,
  isDarkMode,
  className,
}: {
  seed: string;
  isDarkMode: boolean;
  className?: string;
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

  // Choose only the more distinctive shape variants (avoid dot-heavy 0-4).
  const variant = 5 + Math.floor(rand() * 7); // 5..11

  // Precompute deterministic positions (fewer particles so main shapes dominate).
  const dots = Array.from({ length: 7 }).map((_, i) => {
    const x = 8 + rand() * 24;
    const y = 8 + rand() * 24;
    const r = 1.2 + rand() * 2.2;
    const t = i / 5;
    return { x, y, r, t };
  });

  const gradientId = `g-${s}-${variant}`;

  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={bg} stopOpacity="1" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.95" />
        </linearGradient>
      </defs>

      <circle cx="20" cy="20" r="18.5" fill={`url(#${gradientId})`} />
      <circle
        cx="20"
        cy="20"
        r="18.5"
        fill="none"
        stroke={isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}
        strokeWidth="1.4"
      />

      {variant === 0 && (
        <>
          {dots.map((d, i) => (
            <circle
              key={i}
              cx={d.x}
              cy={d.y}
              r={d.r}
              fill={isDarkMode ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.65)'}
            />
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
            d={`M ${10 + rand() * 4} ${8 + rand() * 6} C ${18 + rand() * 8} ${4 + rand() * 10}, ${22 + rand() * 8} ${22 + rand() * 8}, ${
              30 - rand() * 4
            } ${30 - rand() * 6}`}
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
            points={`${12 + rand() * 5},${30 - rand() * 6} ${28 - rand() * 6},${26 - rand() * 6} ${
              18 + rand() * 6
            },${10 + rand() * 6}`}
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
                d={`M 6 ${y} C 14 ${y - 3}, 26 ${y + 3}, 34 ${y}`}
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

      {variant === 5 && (
        <>
          {/* Diagonal stripes */}
          {Array.from({ length: 7 }).map((_, i) => {
            const y = -6 + i * 6 + rand() * 1.2;
            return (
              <path
                key={i}
                d={`M -10 ${y} L 60 ${y + 60}`}
                stroke={isDarkMode ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.55)'}
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.7}
              />
            );
          })}
          {dots.slice(0, 6).map((d, i) => (
            <circle
              key={i}
              cx={d.x}
              cy={d.y}
              r={d.r}
              fill={accent}
              opacity="0.35"
            />
          ))}
        </>
      )}

      {variant === 6 && (
        <>
          {/* Concentric rings + small orbit dots */}
          {Array.from({ length: 4 }).map((_, i) => (
            <circle
              key={i}
              cx="20"
              cy="20"
              r={12 - i * 2 + rand() * 0.6}
              fill="none"
              stroke={isDarkMode ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.55)'}
              strokeWidth={1.6}
              opacity={0.85 - i * 0.12}
            />
          ))}
          {dots.slice(0, 7).map((d, i) => (
            <circle
              key={i}
              cx={d.x}
              cy={d.y}
              r={Math.max(1.1, d.r * 0.9)}
              fill={accent}
              opacity={0.25 + d.t * 0.25}
            />
          ))}
        </>
      )}

      {variant === 7 && (
        <>
          {/* Checker/grid pattern */}
          {Array.from({ length: 4 }).map((_, ix) =>
            Array.from({ length: 4 }).map((_, iy) => {
              const parity = (ix + iy + (s % 7)) % 2;
              if (parity === 0) return null;
              const cell = 10;
              const x = 6 + ix * cell;
              const y = 6 + iy * cell;
              return (
                <rect
                  key={`${ix}-${iy}`}
                  x={x}
                  y={y}
                  width={8}
                  height={8}
                  rx={2}
                  fill={accent}
                  opacity={0.35}
                />
              );
            })
          )}
          {dots.slice(0, 6).map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="rgba(255,255,255,0.22)" opacity={isDarkMode ? 0.55 : 0.7} />
          ))}
        </>
      )}

      {variant === 8 && (
        <>
          {/* Starburst */}
          {Array.from({ length: 10 }).map((_, i) => {
            const ang = (i / 10) * Math.PI * 2 + rand() * 0.25;
            const x2 = 20 + Math.cos(ang) * (10 + rand() * 4);
            const y2 = 20 + Math.sin(ang) * (10 + rand() * 4);
            return (
              <line
                key={i}
                x1="20"
                y1="20"
                x2={x2}
                y2={y2}
                stroke={isDarkMode ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.65)'}
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.75}
              />
            );
          })}
          {dots.slice(0, 5).map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={accent} opacity="0.35" />
          ))}
        </>
      )}

      {variant === 9 && (
        <>
          {/* Wave ribbon */}
          <path
            d="M -5 22 C 5 10, 15 34, 25 22 C 35 10, 45 34, 55 22"
            fill="none"
            stroke={isDarkMode ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.65)'}
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.9"
          />
          <path
            d="M -5 27 C 5 15, 15 39, 25 27 C 35 15, 45 39, 55 27"
            fill="none"
            stroke={accent}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.55"
          />
          {dots.slice(0, 7).map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={Math.max(1.05, d.r * 0.8)} fill={isDarkMode ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.12)'} opacity="0.6" />
          ))}
        </>
      )}

      {variant === 10 && (
        <>
          {/* Orbit ellipses */}
          {Array.from({ length: 4 }).map((_, i) => {
            const rx = 14 - i * 2 + rand() * 1;
            const ry = 7 + i * 1.3 + rand() * 1;
            const rot = rand() * 180;
            return (
              <ellipse
                key={i}
                cx="20"
                cy="20"
                rx={rx}
                ry={ry}
                fill="none"
                stroke={isDarkMode ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.65)'}
                strokeWidth="2"
                opacity={0.8 - i * 0.14}
                transform={`rotate(${rot} 20 20)`}
              />
            );
          })}
          {dots.slice(0, 8).map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={Math.max(1.05, d.r)} fill={accent} opacity={0.22 + i * 0.04} />
          ))}
        </>
      )}

      {variant === 11 && (
        <>
          {/* Comet / sprinkles */}
          <circle cx={12 + rand() * 8} cy={10 + rand() * 6} r={3.5 + rand() * 2.4} fill={accent} opacity="0.35" />
          <path
            d={`M 30 18 C ${28 + rand() * 6} ${10 + rand() * 8}, ${18 + rand() * 8} ${14 + rand() * 10}, 12 22`}
            fill="none"
            stroke={isDarkMode ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.65)'}
            strokeWidth="2.6"
            strokeLinecap="round"
            opacity="0.9"
          />
          {dots.slice(0, 9).map((d, i) => (
            <circle
              key={i}
              cx={d.x}
              cy={d.y}
              r={Math.max(0.95, d.r * (0.7 + rand() * 0.5))}
              fill={isDarkMode ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.12)'}
              opacity={0.55}
            />
          ))}
        </>
      )}
    </svg>
  );
}

