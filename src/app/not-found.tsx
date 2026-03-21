'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Home, Compass } from 'lucide-react';
import { useTheme } from './context/ThemeContext';

export default function NotFound() {
  const { isDarkMode } = useTheme();

  return (
    <div
      className={`relative min-h-[100dvh] w-full overflow-hidden flex flex-col items-center justify-center px-6 py-16 ${
        isDarkMode ? 'bg-black text-white' : 'bg-[#F5F3F0] text-gray-900'
      }`}
    >
      {/* Grid + vignette */}
      <div
        className={`pointer-events-none absolute inset-0 ${
          isDarkMode ? 'opacity-[0.12]' : 'opacity-[0.08]'
        }`}
        style={{
          backgroundImage: `
            linear-gradient(${isDarkMode ? 'rgba(57,255,20,0.15)' : 'rgba(16,185,129,0.2)'} 1px, transparent 1px),
            linear-gradient(90deg, ${isDarkMode ? 'rgba(57,255,20,0.15)' : 'rgba(16,185,129,0.2)'} 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />
      <div
        className={`pointer-events-none absolute inset-0 ${
          isDarkMode
            ? 'bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(57,255,20,0.12),transparent)]'
            : 'bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.15),transparent)]'
        }`}
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-lg">
        <Link
          href="/"
          className="mb-10 opacity-80 hover:opacity-100 transition-opacity"
          aria-label="Peer2Pepu home"
        >
          <Image
            src="/mobile.png"
            alt=""
            width={100}
            height={50}
            className="object-contain h-10 w-auto"
            priority
          />
        </Link>

        <p
          className={`text-[10px] sm:text-xs font-mono tracking-[0.35em] uppercase mb-3 ${
            isDarkMode ? 'text-[#39FF14]/80' : 'text-emerald-700'
          }`}
        >
          Outcome undecided
        </p>

        <div className="relative animate-notfound-float">
          <span
            className={`block text-[5.5rem] sm:text-[7rem] font-black leading-none tabular-nums tracking-tighter ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            } animate-notfound-glow`}
            style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}
          >
            404
          </span>
          <span
            className={`absolute -right-1 -top-1 text-2xl sm:text-3xl ${
              isDarkMode ? 'text-[#39FF14]' : 'text-emerald-600'
            }`}
            aria-hidden
          >
            ?
          </span>
        </div>

        <h1 className={`mt-6 text-xl sm:text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          This page doesn&apos;t exist
        </h1>
        <p
          className={`mt-3 text-sm sm:text-base leading-relaxed max-w-md ${
            isDarkMode ? 'text-white/60' : 'text-gray-600'
          }`}
        >
          The URL you opened isn&apos;t a valid route — maybe it was removed, or the link was mistyped. Head
          back and keep trading predictions.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <Link
            href="/"
            className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-colors ${
              isDarkMode
                ? 'bg-[#39FF14] text-black hover:bg-[#39FF14]/85'
                : 'bg-[#39FF14] text-black border border-black hover:bg-[#39FF14]/85'
            }`}
          >
            <Home className="w-4 h-4 shrink-0" strokeWidth={2} />
            Back to markets
          </Link>
          <Link
            href="/create-market"
            className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-colors ${
              isDarkMode
                ? 'border border-white/20 text-white hover:bg-white/5'
                : 'border border-gray-400 text-gray-900 hover:bg-gray-200/80'
            }`}
          >
            <Compass className="w-4 h-4 shrink-0" strokeWidth={2} />
            Create a market
          </Link>
        </div>
      </div>
    </div>
  );
}
