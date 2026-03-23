"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Inter } from 'next/font/google';
import { 
  Sun,
  Moon,
  Menu,
  X,
  Search,
  ChevronRight,
  ChevronLeft,
  Link as LinkIcon
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useTheme } from '../context/ThemeContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const SECTIONS = [
  { id: 'overview', title: 'Overview', next: 'getting-started' },
  { id: 'getting-started', title: 'Getting Started', prev: 'overview', next: 'participating' },
  { id: 'participating', title: 'Participating', prev: 'getting-started', next: 'market-types' },
  { id: 'market-types', title: 'Market Types', prev: 'participating', next: 'price-feed-oracle' },
  { id: 'price-feed-oracle', title: 'Price Feed Oracle', prev: 'market-types', next: 'optimistic-oracle' },
  { id: 'optimistic-oracle', title: 'Optimistic Oracle', prev: 'price-feed-oracle', next: 'building-bots' },
  { id: 'building-bots', title: 'Building Bots', prev: 'optimistic-oracle', next: 'contract-reference' },
  { id: 'contract-reference', title: 'Contract Reference', prev: 'building-bots' },
];

export default function DocsPage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const { address, isConnected } = useAccount();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('overview');
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    oracles: false,
    bots: false,
  });
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const navigateToSection = (id: string) => {
    const element = sectionRefs.current[id];
    if (element) {
      setActiveSection(id);
      // Update URL hash
      window.history.pushState(null, '', `#${id}`);
    }
    setSidebarOpen(false);
  };

  // Handle initial hash and browser back/forward
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && SECTIONS.find(s => s.id === hash)) {
      setActiveSection(hash);
    }

    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash && SECTIONS.find(s => s.id === hash)) {
        setActiveSection(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);


  const getSectionTransform = (sectionId: string) => {
    const currentIndex = SECTIONS.findIndex(s => s.id === activeSection);
    const sectionIndex = SECTIONS.findIndex(s => s.id === sectionId);
    if (sectionIndex < currentIndex) return 'translate-x-full';
    if (sectionIndex > currentIndex) return '-translate-x-full';
    return 'translate-x-0';
  };

  const copyHeadingUrl = (e: React.MouseEvent<HTMLAnchorElement>, headingId: string) => {
    e.preventDefault();
    const url = `${window.location.origin}${window.location.pathname}#${headingId}`;
    navigator.clipboard.writeText(url);
  };

  /** Body copy — neutral; green only on main doc titles (heading1) */
  const proseMuted = isDarkMode ? 'text-white/80' : 'text-gray-700';
  const proseLead = isDarkMode ? 'text-white/85' : 'text-gray-700';
  /** Section title (h1 only): white + thin green rule — not every heading */
  const heading1 = isDarkMode
    ? 'text-white border-b border-[#39FF14]/25 pb-3'
    : 'text-gray-900 border-b border-emerald-200 pb-3';

  const HeadingLink = ({ headingId, children, className = '' }: { headingId: string; children: React.ReactNode; className?: string }) => (
    <a 
      href={`#${headingId}`} 
      onClick={(e) => copyHeadingUrl(e, headingId)} 
      className={`font-inter text-inherit no-underline hover:text-[#39FF14] transition-colors cursor-pointer inline-flex items-center gap-2 group ${className}`}
    >
      {children}
      <LinkIcon className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
    </a>
  );

  const renderSectionNavigation = (sectionId: string) => {
    const currentSection = SECTIONS.find(s => s.id === sectionId);
    if (!currentSection) return null;

    return (
      <div className={`mt-auto pt-8 sm:pt-12 border-t ${isDarkMode ? 'border-[#39FF14]/20' : 'border-gray-200'}`}>
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          {currentSection.prev ? (
            <button
              type="button"
              onClick={() => navigateToSection(currentSection.prev!)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg transition-colors text-left text-sm sm:text-base w-full sm:w-auto ${
                isDarkMode 
                  ? 'hover:bg-[#39FF14]/10 text-white/80 hover:text-[#39FF14]' 
                  : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
              }`}
            >
              <ChevronLeft size={18} className="shrink-0" />
              <span className="min-w-0">
                <span className="block text-xs opacity-70">Previous</span>
                <span className="font-medium">{SECTIONS.find(s => s.id === currentSection.prev)?.title}</span>
              </span>
            </button>
          ) : (
            <div className="hidden sm:block" />
          )}
          {currentSection.next && (
            <button
              type="button"
              onClick={() => navigateToSection(currentSection.next!)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg transition-colors text-right sm:text-left text-sm sm:text-base w-full sm:w-auto sm:ml-auto flex-row-reverse sm:flex-row ${
                isDarkMode 
                  ? 'hover:bg-[#39FF14]/10 text-white/80 hover:text-[#39FF14]' 
                  : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
              }`}
            >
              <ChevronRight size={18} className="shrink-0" />
              <span className="min-w-0 sm:text-right">
                <span className="block text-xs opacity-70">Next</span>
                <span className="font-medium">{SECTIONS.find(s => s.id === currentSection.next)?.title}</span>
              </span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`${inter.variable} min-h-screen ${isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'}`}>
      {/* Mobile header: nav + tools + search */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-md ${isDarkMode ? 'bg-black/95 border-[#39FF14]/20' : 'bg-[#F5F3F0]/95 border-gray-200'} lg:hidden`}>
        <div className="px-3 pt-2 pb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2 rounded-lg transition-colors shrink-0 ${isDarkMode ? 'hover:bg-[#39FF14]/10 text-white' : 'hover:bg-gray-200 text-gray-900'}`}
            aria-label={sidebarOpen ? 'Close docs menu' : 'Open docs menu'}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className={`text-sm font-bold truncate flex-1 text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Documentation
          </h1>
          <button
            type="button"
            onClick={toggleTheme}
            className={`p-2 rounded-lg transition-colors shrink-0 ${isDarkMode ? 'hover:bg-[#39FF14]/10 text-white' : 'hover:bg-gray-200 text-gray-700'}`}
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="shrink-0 scale-90 origin-right [&_button]:!min-h-0 [&_button]:!py-1.5 [&_button]:!text-xs">
            {isConnected ? (
              <span
                className={`inline-flex items-center px-2 py-1.5 rounded-md text-[10px] font-mono font-medium max-w-[88px] truncate ${
                  isDarkMode
                    ? 'bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
                title={address ?? ''}
              >
                {address?.slice(0, 4)}…{address?.slice(-3)}
              </span>
            ) : (
              <ConnectButton />
            )}
          </div>
        </div>
        <div className="px-3 pb-2">
          <div className={`relative rounded-lg border ${isDarkMode ? 'bg-gray-900/80 border-[#39FF14]/25' : 'bg-white border-gray-300'}`}>
            <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`} />
            <input
              type="search"
              enterKeyHint="search"
              placeholder="Search docs…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 text-sm bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50 rounded-lg ${
                isDarkMode ? 'text-white placeholder:text-white/40' : 'text-gray-900 placeholder:text-gray-400'
              }`}
            />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Docs Sidebar */}
        <aside className={`
          fixed lg:sticky top-0 h-[100dvh] max-h-screen overflow-y-auto z-50 lg:z-30
          ${isDarkMode ? 'bg-black border-r border-[#39FF14]/20' : 'bg-white border-r border-gray-200'}
          w-[min(100vw-3rem,16rem)] sm:w-64 flex-shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          transition-transform duration-300
          shadow-xl lg:shadow-none
        `}>
          <div className={`p-3 sm:p-4 border-b ${isDarkMode ? 'border-[#39FF14]/20' : 'border-gray-200'}`}>
            <Link href="/" className="flex items-center" onClick={() => setSidebarOpen(false)}>
              <Image
                src="/logo.png"
                alt="Peer2Pepu Logo"
                width={180}
                height={60}
                className="object-contain w-[140px] sm:w-[160px] h-auto"
                priority
              />
            </Link>
          </div>

          <div className="p-3 sm:p-6 pb-6">
            <nav className="space-y-0.5 sm:space-y-1">
              {SECTIONS.map((section) => {
                const isActive = activeSection === section.id;
                return (
              <button
                    type="button"
                    key={section.id}
                    onClick={() => navigateToSection(section.id)}
                className={`w-full text-left px-3 py-2.5 sm:py-2 rounded text-sm transition-colors ${
                      isActive
                        ? isDarkMode
                          ? 'bg-[#39FF14]/20 text-[#39FF14] border-l-2 border-[#39FF14]'
                          : 'bg-[#39FF14]/20 text-green-700 border-l-2 border-green-500'
                        : isDarkMode
                    ? 'hover:bg-[#39FF14]/10 text-white/80 hover:text-[#39FF14]' 
                    : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
                }`}
              >
                    {section.title}
              </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-hidden relative">
          {/* Desktop Header */}
          <header className={`hidden lg:block fixed top-0 left-64 right-0 z-30 border-b backdrop-blur-sm ${isDarkMode ? 'bg-black border-[#39FF14]/20' : 'bg-[#F5F3F0] border-gray-200'}`}>
            <div className="px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 max-w-md">
                  <div className={`relative ${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-lg border ${isDarkMode ? 'border-[#39FF14]/30' : 'border-gray-300'}`}>
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-white/50' : 'text-gray-400'}`} />
                    <input
                      type="text"
                      placeholder="Search documentation..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full pl-9 pr-4 py-1.5 text-sm bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-[#39FF14] rounded-lg ${
                        isDarkMode ? 'text-white placeholder-white/50' : 'text-gray-900 placeholder-gray-400'
                      }`}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={toggleTheme}
                    className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-[#39FF14]/10 text-white' : 'hover:bg-gray-200'}`}
                  >
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                  </button>
                  {isConnected ? (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium ${
                      isDarkMode 
                        ? 'bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30' 
                        : 'bg-[#39FF14]/10 text-green-700 border border-green-300'
                    }`}>
                      <span className="font-mono text-sm">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                    </div>
                  ) : (
                    <ConnectButton />
                  )}
                </div>
              </div>
            </div>
          </header>

          <div 
            className="h-[100dvh] min-h-0 lg:h-screen overflow-hidden relative"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            <style jsx global>{`
              div::-webkit-scrollbar,
              section::-webkit-scrollbar {
                display: none;
                width: 0;
                height: 0;
              }
              div,
              section {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
            `}</style>
            <div className="max-w-4xl mx-auto h-full relative w-full">
            {/* Overview Section */}
            <section 
              id="overview" 
              ref={(el) => { sectionRefs.current['overview'] = el; }}
              className={`absolute inset-0 flex flex-col px-4 sm:px-6 pb-8 sm:pb-12 pt-16 lg:pt-[100px] transition-all duration-500 overflow-y-auto overflow-x-hidden ${activeSection === 'overview' ? 'translate-x-0 opacity-100 z-10' : '-translate-x-full opacity-0 z-0 pointer-events-none'}`}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <h1 id="overview" className={`font-inter text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-left group ${heading1}`}>
                <a href="#overview" onClick={(e) => copyHeadingUrl(e, 'overview')} className="text-inherit no-underline hover:text-[#39FF14] transition-colors cursor-pointer inline-flex items-center gap-2 group">
                  Overview
                  <LinkIcon className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                </a>
              </h1>

              <p className={`text-lg sm:text-xl leading-relaxed mb-8 sm:mb-12 ${proseLead}`}>
                Welcome to the P2P Prediction Markets platform documentation. This comprehensive guide will help you understand how to create, participate in, and interact with decentralized prediction markets on the Pepe Unchained blockchain.
              </p>

              <h2 id="what-are-prediction-markets" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left group ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#what-are-prediction-markets" onClick={(e) => copyHeadingUrl(e, 'what-are-prediction-markets')} className="text-inherit no-underline hover:text-[#39FF14] transition-colors cursor-pointer inline-flex items-center gap-2 group">
                  What are Prediction Markets?
                  <LinkIcon className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                </a>
              </h2>
              <p className={`mb-6 leading-relaxed text-base sm:text-lg ${proseMuted}`}>
                Prediction markets are decentralized platforms where participants can stake tokens on the outcome of future events. Unlike traditional betting, prediction markets aggregate collective knowledge and provide financial incentives for accurate predictions. They serve multiple purposes including information aggregation, price discovery, and risk management.
              </p>
              <p className={`mb-6 leading-relaxed text-base sm:text-lg ${proseMuted}`}>
                In a prediction market, users stake tokens on their preferred outcome. The market price of each outcome reflects the collective belief about its probability. When the event resolves, winners receive payouts proportional to their stake and the total pool, while losers forfeit their staked tokens.
              </p>

              <h2 id="key-features" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left group ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#key-features" onClick={(e) => copyHeadingUrl(e, 'key-features')} className="text-inherit no-underline hover:text-[#39FF14] transition-colors cursor-pointer inline-flex items-center gap-2 group">
                  Key Features
                  <LinkIcon className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                </a>
              </h2>
              <ul className={`list-disc list-outside pl-5 space-y-3 mb-8 text-base sm:text-lg ${proseMuted} ${isDarkMode ? '[&>li>strong]:text-[#39FF14]' : '[&>li>strong]:text-emerald-700'}`}>
                <li><strong>Decentralized:</strong> Built entirely on the Pepe Unchained blockchain with no central authority controlling markets or outcomes</li>
                <li><strong>Transparent:</strong> All market data, stakes, and outcomes are recorded on-chain and publicly verifiable</li>
                <li><strong>Flexible:</strong> Support for binary (Yes/No) and multi-option markets with customizable options</li>
                <li><strong>Automated:</strong> Price feed markets resolve automatically without requiring manual intervention</li>
                <li><strong>Dispute Resolution:</strong> Optimistic Oracle provides a secure mechanism for resolving subjective events with challenge periods</li>
                <li><strong>Multi-token Support:</strong> Stake using various ERC20 tokens or native PEPU tokens, providing flexibility for participants</li>
                <li><strong>Creator Incentives:</strong> Market creators can stake on their preferred outcome, aligning incentives with market quality</li>
                <li><strong>Platform Fees:</strong> Transparent fee structure supports ecosystem sustainability and development</li>
                <li><strong>Time-based Phases:</strong> Clear separation between staking, ending, and resolution phases provides structure and predictability</li>
                <li><strong>On-chain Metadata:</strong> Market details stored on IPFS with on-chain references for permanent, decentralized storage</li>
              </ul>

              {renderSectionNavigation('overview')}
            </section>

            {/* Getting Started Section */}
            <section 
              id="getting-started" 
              ref={(el) => { sectionRefs.current['getting-started'] = el; }}
              className={`absolute inset-0 flex flex-col px-4 sm:px-6 pb-8 sm:pb-12 pt-16 lg:pt-[100px] transition-all duration-500 overflow-y-auto overflow-x-hidden ${activeSection === 'getting-started' ? 'translate-x-0 opacity-100 z-10' : getSectionTransform('getting-started') + ' opacity-0 z-0 pointer-events-none'}`}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <h1 id="getting-started" className={`font-inter text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-left ${heading1}`}>
                <HeadingLink headingId="getting-started">Getting Started</HeadingLink>
              </h1>
              <p className={`text-lg sm:text-xl leading-relaxed mb-8 sm:mb-12 ${proseLead}`}>
                Learn how to create and participate in prediction markets on the P2P platform.
              </p>

              <h2 id="market-creation" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="market-creation">Creating a Market</HeadingLink>
              </h2>
              <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                Creating a prediction market requires several steps. First, the creator defines the event or question that the market will resolve. This includes writing a clear title, detailed description, and providing relevant resources or links that help participants make informed decisions.
              </p>
              <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                The creator must choose between two resolution mechanisms: Price Feed markets for objective price-based questions, or Optimistic Oracle markets for subjective events requiring human judgment. They set the market duration, staking period, and resolution timeframe. A creator deposit is required to ensure commitment, and creators can optionally stake on their preferred outcome.
              </p>
              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                For Price Feed markets, the creator selects a price feed (ETH/USD, BTC/USD, SOL/USD, or PEPU/USD) and sets a threshold. The market will automatically resolve based on whether the price is above or below this threshold at resolution time. For Optimistic Oracle markets, the creator defines options (Yes/No for binary, or multiple options) and the market requires manual resolution through the oracle system.
              </p>

              {renderSectionNavigation('getting-started')}
            </section>

            {/* Participating Section */}
            <section 
              id="participating" 
              ref={(el) => { sectionRefs.current['participating'] = el; }}
              className={`absolute inset-0 flex flex-col px-4 sm:px-6 pb-8 sm:pb-12 pt-16 lg:pt-[100px] transition-all duration-500 overflow-y-auto overflow-x-hidden ${activeSection === 'participating' ? 'translate-x-0 opacity-100 z-10' : getSectionTransform('participating') + ' opacity-0 z-0 pointer-events-none'}`}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <h1 id="participating" className={`font-inter text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-left ${heading1}`}>
                <HeadingLink headingId="participating">Participating in Markets</HeadingLink>
              </h1>
              <p className={`text-lg sm:text-xl leading-relaxed mb-8 sm:mb-12 ${proseLead}`}>
                Learn how to stake on markets, understand the resolution process, and claim your winnings.
              </p>

              <h2 id="staking-phase" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="staking-phase">Staking Phase</HeadingLink>
              </h2>
              <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                Once a market is created, it enters the staking phase. During this period, any user can stake tokens on their preferred outcome. The amount you stake determines your potential payout if your chosen outcome wins. The payout ratio is calculated based on the total pool and the proportion of stakes on the winning option.
              </p>
              <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                Staking requires meeting the minimum stake amount set by the market creator. You can stake using the payment token specified by the creator, which may be native PEPU tokens or any supported ERC20 token. The platform supports multiple tokens to provide flexibility and accessibility.
              </p>
              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                The staking phase ends at the specified stake end time. After this point, no new stakes can be placed, but the market remains active until the end time is reached. This allows for a period where the market is closed to new participants but hasn't yet ended.
              </p>

              <h2 id="market-end" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="market-end">Market End</HeadingLink>
              </h2>
              <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                When the market end time is reached, the market automatically transitions to the "Ended" state. Once ended, the market is locked and no further stakes can be placed.
              </p>
              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                The market remains in the Ended state until resolution occurs. For Price Feed markets, resolution happens automatically after the resolution end time. For Optimistic Oracle markets, resolution requires an assertion to be made and the liveness period to pass.
              </p>

              <h2 id="resolution" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="resolution">Resolution</HeadingLink>
              </h2>
              <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                Resolution is the process of determining the winning outcome. For Price Feed markets, resolution is automatic. When the resolution end time is reached, the system queries the on-chain price feed and compares it to the threshold. If the price is greater than or equal to the threshold, Option 1 (Yes) wins. Otherwise, Option 2 (No) wins.
              </p>
              <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                For Optimistic Oracle markets, resolution is more complex. A user posts an assertion (claim + bond). There is a short <strong>assertion-only phase</strong> (defaults vary by deployment; often ~2 hours) where disputes cannot be filed yet. After that, a <strong>12-hour dispute window</strong> opens: anyone can dispute by posting a bond and choosing the option they believe won. If a dispute is filed, stakers vote for <strong>24 hours</strong> (token-weighted). If nobody disputes in time, anyone can settle after the assertion-only phase and the asserted outcome wins. If disputed, <strong>P2PVoting</strong> tallies the vote, then the oracle settles and the market resolves to either the <strong>asserted option</strong> or the <strong>disputed option</strong> — not a blanket cancel.
              </p>
              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                Exact timestamps come from on-chain parameters (<code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>assertionWindow</code>, <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>defaultLiveness</code>, <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>votingWindow</code>); P2P is tuned so you effectively get a <strong>12h</strong> dispute window and <strong>24h</strong> vote as described above.
              </p>

              <h2 id="payouts" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="payouts">Claiming Payouts</HeadingLink>
              </h2>
              <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                Once a market is resolved, winners can claim their payouts. The payout calculation is based on the total pool size and the proportion of stakes on the winning option. If you staked on the winning outcome, you receive a share of the total pool proportional to your stake.
              </p>
              <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                A small platform fee is deducted from the total pool before payouts are distributed. This fee supports the ecosystem, including infrastructure costs, development, and platform sustainability. The fee structure is transparent and visible when creating or participating in markets.
              </p>
              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                Users who staked on losing options do not receive any payout. Their staked tokens become part of the winning pool. This creates an incentive structure where accurate predictions are rewarded, and the market naturally aggregates information through price discovery.
              </p>

              {renderSectionNavigation('participating')}
            </section>

            {/* Market Types Section */}
            <section 
              id="market-types" 
              ref={(el) => { sectionRefs.current['market-types'] = el; }}
              className={`absolute inset-0 flex flex-col px-4 sm:px-6 pb-8 sm:pb-12 pt-16 lg:pt-[100px] transition-all duration-500 overflow-y-auto overflow-x-hidden ${activeSection === 'market-types' ? 'translate-x-0 opacity-100 z-10' : getSectionTransform('market-types') + ' opacity-0 z-0 pointer-events-none'}`}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <h1 id="market-types" className={`font-inter text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-left ${heading1}`}>
                <HeadingLink headingId="market-types">Market Types</HeadingLink>
              </h1>
              <p className={`text-lg sm:text-xl leading-relaxed mb-8 sm:mb-12 ${proseLead}`}>
                Understand the different types of markets available and when to use each one.
              </p>

              <h2 id="price-feed-markets" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="price-feed-markets">Price Feed Markets</HeadingLink>
              </h2>
              <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                Price Feed markets are binary (Yes/No) markets that automatically resolve based on on-chain price data. These markets are perfect for objective, price-based questions where the outcome can be definitively determined by querying a price feed contract.
              </p>
              <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                When creating a Price Feed market, you select one of the available price feeds: ETH/USD, BTC/USD, SOL/USD, or PEPU/USD. You then set a price threshold and choose whether "Yes" wins if the price is above the threshold (Over) or below the threshold (Under). The market automatically resolves when the resolution time is reached by comparing the current price from the feed against your threshold.
              </p>
              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                These markets are ideal for questions like "Will ETH be above $3000 by end of month?" or "Will BTC drop below $40,000 this week?" The resolution is trustless and automatic, requiring no human judgment or oracle intervention beyond the price feed itself.
              </p>

              <h2 id="optimistic-oracle-markets" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="optimistic-oracle-markets">Optimistic Oracle Markets</HeadingLink>
              </h2>
              <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                Optimistic Oracle markets support both binary and multi-option outcomes. These markets are designed for subjective events or complex questions that require human judgment to resolve. Examples include sports outcomes, election results, product launches, or any event where the outcome cannot be determined purely from on-chain data.
              </p>
              <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                Resolution for Optimistic Oracle markets follows a specific process. After the market ends, a qualified user posts an assertion (bond + claim + winning option in callback data). Disputes are <strong>not</strong> allowed during the short assertion-only phase; then a <strong>12-hour dispute window</strong> opens where anyone can dispute with a matching bond and pick the option they say actually won. If disputed, a <strong>24-hour</strong> <strong>P2PVoting</strong> round opens: in the app you choose the <strong>asserted option</strong> or the <strong>disputed option</strong>; on-chain that is vote values <strong>1</strong> or <strong>2</strong>. Whichever side wins sets the market’s <strong>winning option</strong> (asserted or disputed) for payouts.
              </p>
              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                If no dispute is filed, anyone can settle after the assertion window ends and the asserted outcome wins. This optimistic path is fast; disputes fall back to weighted voting, then oracle settlement.
              </p>

              {renderSectionNavigation('market-types')}
            </section>

            {/* Optimistic Oracle Section */}
            <section 
              id="optimistic-oracle" 
              ref={(el) => { sectionRefs.current['optimistic-oracle'] = el; }}
              className={`absolute inset-0 flex flex-col px-4 sm:px-6 pb-8 sm:pb-12 pt-16 lg:pt-[100px] transition-all duration-500 overflow-y-auto overflow-x-hidden ${activeSection === 'optimistic-oracle' ? 'translate-x-0 opacity-100 z-10' : getSectionTransform('optimistic-oracle') + ' opacity-0 z-0 pointer-events-none'}`}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <h1 id="optimistic-oracle" className={`font-inter text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-left ${heading1}`}>
                <HeadingLink headingId="optimistic-oracle">P2P Optimistic Oracle</HeadingLink>
              </h1>
              <p className={`text-lg sm:text-xl leading-relaxed mb-8 sm:mb-12 ${proseLead}`}>
                The P2P Optimistic Oracle provides a decentralized mechanism for resolving subjective events in prediction markets. It uses an optimistic approach where assertions are assumed correct unless challenged, enabling fast resolution while maintaining security through dispute mechanisms and token-weighted voting.
              </p>

              <h2 id="how-optimistic-works" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="how-optimistic-works">How It Works</HeadingLink>
              </h2>
              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                The Optimistic Oracle resolution process consists of four main steps:
              </p>

              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Step 1: Assert</h3>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  After a market ends, any user (except the creator) who has staked on the market can make an assertion about which outcome should win. The asserter must:
                </p>
                <ul className={`list-disc list-outside pl-5 space-y-2 mb-4 ${proseMuted}`}>
                  <li>Post a bond (stake) to the oracle contract</li>
                  <li>Provide a human-readable claim describing the outcome</li>
                  <li>Encode the winning option ID in callback data</li>
                </ul>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  Once asserted, disputes are only allowed <strong>after</strong> the assertion-only phase, then within the <strong>12-hour dispute window</strong>. If nobody disputes in time, anyone can settle and the assertion is accepted. If someone disputes, a <strong>24-hour</strong> vote runs in P2PVoting; after that and once the oracle assertion reaches <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>expirationTime</code>, anyone can call <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>settleOracle</code>.
                </p>
              </div>

              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Step 2: Dispute (Optional)</h3>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  Anyone who disagrees can dispute during the <strong>12-hour dispute window</strong> (after the assertion-only phase) by:
                </p>
                <ul className={`list-disc list-outside pl-5 space-y-2 mb-4 ${proseMuted}`}>
                  <li>Posting an equal bond</li>
                  <li>Selecting the option they believe actually won (stored on-chain as the <strong>disputed option</strong>)</li>
                  <li>That action opens a <strong>24-hour</strong> vote in <strong>P2PVoting</strong></li>
                </ul>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  Voters then choose <strong>asserted option</strong> vs <strong>disputed option</strong>. If the disputed side wins the vote, the market <strong>resolves to that option</strong> for payouts — the same resolve flow as when the assertion wins, just a different winning option id.
                </p>
              </div>

              <h2 id="voting-mechanism" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="voting-mechanism">How Voting Works</HeadingLink>
              </h2>
              <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                Below is the flow as <strong>you see it in P2P</strong> (Resolve / Assert page), then how the contracts implement it.
              </p>

              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Example: simple “Team A vs Team B” market</h3>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  Imagine a binary market: <strong>Option 1 — Team A wins</strong>, <strong>Option 2 — Team B wins</strong>.
                </p>
                <ol className={`list-decimal list-outside pl-5 space-y-3 mb-4 ${proseMuted}`}>
                  <li>
                    <strong>Assert:</strong> After the market ends, someone who staked on the market opens <strong>Resolve Markets</strong>, selects <strong>Team A wins</strong>, and submits an <strong>assertion</strong>. They post the required <strong>P2P bond</strong> and a short claim. In the UI you see their choice as the outcome they are standing behind.
                  </li>
                  <li>
                    <strong>Wait, then dispute (optional):</strong> After the assertion-only phase, a <strong>12-hour dispute window</strong> runs. Anyone can <strong>dispute</strong> in that window: they pick <strong>Team B wins</strong> (the outcome they believe is correct), post the <strong>same-size bond</strong>, and confirm. That option is stored as the <strong>disputed option</strong> for this fight.
                  </li>
                  <li>
                    <strong>Vote (24 hours):</strong> P2P holders who have staked in <strong>Interactions → Voting Stake</strong> have <strong>24 hours</strong> to vote once per dispute. The choices are <strong>asserted option</strong> vs <strong>disputed option</strong> — here <strong>Team A</strong> vs <strong>Team B</strong> (with claim text in the UI). You are choosing which side of <em>this</em> dispute you support.
                  </li>
                  <li>
                    <strong>Outcome you see:</strong> If the asserted side wins, the market <strong>resolves to Team A</strong> and normal winner payouts apply. If the disputed side wins, the market <strong>resolves to Team B</strong> (the disputer’s option) — same resolved market, same payout flow for whoever staked on the winning option. The assertion is rejected on-chain, but the product still picks a <strong>definite winning option</strong> for the market.
                  </li>
                </ol>
                <p className={`mb-0 leading-relaxed ${proseMuted}`}>
                  Multi-option markets work the same way: the asserter picks one outcome ID, the disputer picks another when they dispute, and voters see those two outcomes as the asserted vs disputed side.
                </p>
              </div>

              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Token-Weighted Voting</h3>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  Voting is token-weighted, meaning your voting power is proportional to the amount of P2P tokens you have staked in the P2PVoting contract. To participate in voting:
                </p>
                <ul className={`list-disc list-outside pl-5 space-y-2 mb-4 ${proseMuted}`}>
                  <li><strong>Stake P2P tokens:</strong> You must have a non-zero <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>stakedBalance</code> in P2PVoting when you call <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>vote</code> (stake can be added any time before you vote)</li>
                  <li><strong>Voting weight:</strong> Your weight is your full staked balance at the moment you vote; that amount is also used to compute how much can be slashed or rewarded for this round</li>
                  <li><strong>One vote per request:</strong> Each address votes at most once per vote request, but can vote on other disputes separately</li>
                  <li><strong>Locked stake:</strong> While a vote is pending, a portion of your stake (<code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>slashBps</code>) is locked and cannot be unstaked until the request is resolved</li>
                </ul>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  This system ensures that stakeholders with more tokens have proportionally more influence, aligning voting power with economic interest in the platform.
                </p>
              </div>

              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>What you vote on in the app</h3>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  The UI is built around the <strong>two sides of the dispute</strong>:
                </p>
                <ul className={`list-disc list-outside pl-5 space-y-2 mb-4 ${proseMuted}`}>
                  <li><strong>Asserted option</strong> — the outcome the asserter committed to when they posted their bond and claim (shown as the current assertion).</li>
                  <li><strong>Disputed option</strong> — the outcome the disputer chose when they posted their bond to challenge (the opposing side in the same dispute).</li>
                </ul>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  Your vote adds weight to one of those two sides. Whichever side has more <strong>total staked P2P voting weight</strong> wins the dispute (not “who clicked first” or raw voter count).
                </p>
                <h4 className={`text-sm font-semibold mb-2 mt-6 ${isDarkMode ? 'text-white/90' : 'text-gray-800'}`}>Behind the hood (P2PVoting + oracle + market manager)</h4>
                <p className={`mb-3 leading-relaxed ${proseMuted}`}>
                  <strong>P2PVoting</strong> stores votes as <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>1</code> or <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>2</code>: <strong>1</strong> = uphold the assertion, <strong>2</strong> = reject it. The oracle turns that into <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>result = true</code> or <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>false</code>. <strong>P2PMarketManager</strong> then sets the market winner: if <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>true</code>, it uses the option id from the assertion callback data; if <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>false</code>, it uses the <strong>disputer’s option id</strong> saved when they called <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>disputeOracle(marketId, optionId)</code>. <strong>Ties</strong> at the oracle favor the assertion (<code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>acceptWeight &gt;= rejectWeight</code>).
                </p>
              </div>

              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Voting Timeline</h3>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  The voting process follows a specific timeline:
                </p>
                <ol className={`list-decimal list-outside pl-5 space-y-2 mb-4 ${proseMuted}`}>
                  <li><strong>Dispute window:</strong> After the assertion-only phase, disputers have <strong>12 hours</strong> to call <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>disputeOracle(marketId, optionId)</code> and lock in the <strong>disputed option</strong>.</li>
                  <li><strong>Vote request created:</strong> When a dispute is filed, the oracle calls <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>requestVote</code>. The vote deadline is <strong>24 hours</strong> from that moment (<code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>votingWindow</code>).</li>
                  <li><strong>Voting period:</strong> In the app you pick the <strong>asserted</strong> or <strong>disputed</strong> side; under the hood that is <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>vote(requestId, 1 | 2)</code> before the deadline.</li>
                  <li><strong>Resolving the vote:</strong> <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>resolveVote</code> may run inside <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>settleOracle()</code> once the <strong>24h</strong> vote has ended and the oracle assertion has reached <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>expirationTime</code>.</li>
                  <li><strong>Settle oracle:</strong> <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>settleOracle()</code> finalizes bonds and the boolean result passed into <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>resolveP2PMarket</code>.</li>
                </ol>
              </div>

              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Minimum Participation & Consensus</h3>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  To ensure meaningful participation, the voting system requires a minimum threshold:
                </p>
                <ul className={`list-disc list-outside pl-5 space-y-2 mb-4 ${proseMuted}`}>
                  <li><strong>Minimum participation:</strong> The <strong>sum of vote weights</strong> cast on the request must be at least <strong>1,000 P2P</strong> (default <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>minParticipation = 1000e18</code>). If total weight is below that, the request ends in <strong>NoConsensus</strong>.</li>
                  <li><strong>Resolved:</strong> If the threshold is met, the side with greater weight wins — in the app that is either the <strong>asserted option</strong> or the <strong>disputed option</strong>. Ties count as the asserted side winning at the oracle.</li>
                  <li><strong>No consensus:</strong> No slashing occurs; locked amounts are released; the oracle treats the assertion as <strong>accepted</strong> and <strong>returns both bonds</strong> (asserter and disputer). EventPool then resolves the market as if the assertion succeeded.</li>
                </ul>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  Defaults can be changed by the contract owner; check on-chain <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>minParticipation</code> for your deployment.
                </p>
              </div>

              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Slashing & Rewards</h3>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  The voting system includes economic incentives to encourage accurate voting:
                </p>
                <ul className={`list-disc list-outside pl-5 space-y-2 mb-4 ${proseMuted}`}>
                  <li><strong>When it applies:</strong> Slashing and rewards run only inside <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>resolveVote</code> when the request is <strong>Resolved</strong> (not NoConsensus).</li>
                  <li><strong>Wrong voters:</strong> Lose <strong>15%</strong> of the stake they had <strong>at vote time</strong> (<code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>slashBps = 1500</code>), capped by their current staked balance.</li>
                  <li><strong>Correct voters:</strong> Receive a pro-rata share of the round’s slash pool, credited automatically to their <strong>P2PVoting staked balance</strong> (no separate “claim reward” transaction).</li>
                  <li><strong>Locks:</strong> After resolution, this round’s locked amounts are cleared as part of the same transaction.</li>
                </ul>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  <code className={`px-1.5 py-0.5 rounded text-sm ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>slashBps</code> and other parameters are owner-configurable; verify live values on-chain.
                </p>
              </div>

              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Step 3: Settle</h3>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  After the expiration period, anyone can call <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>settleOracle()</code> to finalize the result:
                </p>
                <ul className={`list-disc list-outside pl-5 space-y-2 mb-4 ${proseMuted}`}>
                  <li><strong>No dispute:</strong> After the assertion window (default 2h), assertion accepted; asserter receives their bond</li>
                  <li><strong>Disputed + resolved vote:</strong> Compare accept vs reject weight; winner receives <strong>both</strong> bonds</li>
                  <li><strong>Disputed + no consensus:</strong> Assertion accepted; <strong>each</strong> party gets their own bond back; no bond sweep to one winner</li>
                </ul>
              </div>

              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Step 4: Resolve</h3>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  Finally, call <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>resolveP2PMarket()</code> to read the oracle result:
                </p>
                <ul className={`list-disc list-outside pl-5 space-y-2 mb-4 ${proseMuted}`}>
                  <li><strong>Result = true:</strong> Market resolves to the <strong>asserted option id</strong> from the assertion; winners on that option claim payouts.</li>
                  <li><strong>Result = false:</strong> Assertion rejected, but the market still <strong>resolves</strong> to the <strong>disputed option id</strong> the disputer submitted with <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>disputeOracle</code>; payouts follow that winning option.</li>
                </ul>
              </div>

              <h2 id="optimistic-flow" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="optimistic-flow">Resolution Flow</HeadingLink>
              </h2>

              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Normal Flow (No Dispute)</h3>
                <pre className={`p-3 sm:p-4 rounded-lg overflow-x-auto text-[11px] sm:text-sm leading-relaxed max-w-full ${isDarkMode ? 'bg-black text-green-400' : 'bg-gray-900 text-green-300'}`}>
{`endMarket(id)
  └─ block.timestamp >= market.endTime

requestP2PResolution(id, optionId, claim)
  └─ asserter posts bond, oracle stores claim + callbackData

[after 2h assertion window — no dispute filed]

settleOracle(id)
  └─ oracle sees no disputer → accepts assertion

resolveP2PMarket(id)
  └─ reads result=true, decodes optionId
  └─ market resolves, winnings claimable`}
                </pre>
                </div>

              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Disputed Flow (Vote Required)</h3>
                <pre className={`p-3 sm:p-4 rounded-lg overflow-x-auto text-[11px] sm:text-sm leading-relaxed max-w-full ${isDarkMode ? 'bg-black text-green-400' : 'bg-gray-900 text-green-300'}`}>
{`endMarket(id)
requestP2PResolution(id, assertedOptionId, claim)

[12h dispute window after assertion-only phase]
disputeOracle(id, disputedOptionId)
  └─ disputer posts equal bond + chosen winning option
  └─ oracle creates vote request in P2PVoting
  └─ 24h vote: P2P stakers vote (UI: asserted vs disputed; chain: 1 / 2)

[after oracle expirationTime — 24h vote must have ended]
settleOracle(id)
  └─ resolves vote if needed, compares weight for 1 vs 2
  └─ If accept (1) wins or ties: asserter gets both bonds
  └─ If reject (2) wins: disputer gets both bonds
  └─ If no consensus: both bonds returned; assertion treated accepted

resolveP2PMarket(id)  // P2PMarketManager
  └─ result=true  → winningOption = assertedOptionId (from callback)
  └─ result=false → winningOption = disputedOptionId (stored at dispute)`}
                </pre>
              </div>

              <h2 id="optimistic-fallback" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="optimistic-fallback">Fallback Mechanisms</HeadingLink>
              </h2>
              <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                The system includes several safety mechanisms to prevent permanent fund lock:
              </p>
              <ul className={`list-disc list-outside pl-5 space-y-3 mb-6 ${proseMuted}`}>
                <li><strong>No Assertion Grace Period:</strong> If no one asserts within 48 hours after market end, <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>cancelMarketNoAssertion()</code> can be called to cancel the market and allow refunds.</li>
                <li><strong>Vote rejects assertion:</strong> If the oracle settles with <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>result=false</code>, the market still <strong>resolves</strong> to the <strong>disputed option</strong> recorded at dispute time (via <strong>P2PMarketManager</strong>) — not a full-market cancel.</li>
                <li><strong>No consensus:</strong> If total vote weight stays below <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>minParticipation</code>, bonds return to asserter and disputer; the oracle still treats the assertion as <strong>accepted</strong>, so the market resolves to the <strong>asserted</strong> option.</li>
              </ul>
              {renderSectionNavigation('optimistic-oracle')}
            </section>

            {/* Price Feeds Section */}
            <section 
              id="price-feed-oracle" 
              ref={(el) => { sectionRefs.current['price-feed-oracle'] = el; }}
              className={`absolute inset-0 flex flex-col px-4 sm:px-6 pb-8 sm:pb-12 pt-16 lg:pt-[100px] transition-all duration-500 overflow-y-auto overflow-x-hidden ${activeSection === 'price-feed-oracle' ? 'translate-x-0 opacity-100 z-10' : getSectionTransform('price-feed-oracle') + ' opacity-0 z-0 pointer-events-none'}`}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <h1 id="price-feed-oracle" className={`font-inter text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-left ${heading1}`}>
                <HeadingLink headingId="price-feed-oracle">Price Feed Oracle</HeadingLink>
              </h1>
              <p className={`text-lg sm:text-xl leading-relaxed mb-8 sm:mb-12 ${proseLead}`}>
                Price Feed markets use on-chain price data for automatic, trustless resolution. These markets are perfect for objective, price-based questions where the outcome can be definitively determined by querying a Chainlink-compatible price feed contract.
              </p>

              <h2 id="how-price-feed-works" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="how-price-feed-works">How It Works</HeadingLink>
              </h2>
              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                Price Feed markets resolve automatically in a single transaction:
              </p>

              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>1. Market Creation</h3>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  When creating a Price Feed market, the creator must:
                </p>
                <ul className={`list-disc list-outside pl-5 space-y-2 mb-4 ${proseMuted}`}>
                  <li>Select a price feed contract (ETH/USD, BTC/USD, SOL/USD, or PEPU/USD)</li>
                  <li>Set a price threshold value</li>
                  <li>Define the resolution end time</li>
                </ul>
              </div>

              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>2. Market End</h3>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  When the market end time is reached, anyone can call <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>endMarket()</code> to transition the market to the "Ended" state. This is typically handled automatically by bots.
                </p>
              </div>

              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>3. Resolution</h3>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  After the resolution end time, anyone can call <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>resolvePriceFeedMarket()</code>. The contract:
                </p>
                <ol className={`list-decimal list-outside pl-5 space-y-2 mb-4 ${proseMuted}`}>
                  <li>Queries the price feed: <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>feed.latestRoundData()</code></li>
                  <li>Compares price to threshold: <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>price &gt;= threshold ? Option 1 : Option 2</code></li>
                  <li>Sets the winning option and marks market as resolved</li>
                  <li>Distributes fees and enables winners to claim payouts</li>
                </ol>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  <strong>Resolution is instant</strong> — no voting, no disputes, no waiting periods. The outcome is determined purely by on-chain data.
                </p>
                </div>

              <h2 id="price-feed-flow" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="price-feed-flow">Resolution Flow</HeadingLink>
              </h2>

              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <pre className={`p-3 sm:p-4 rounded-lg overflow-x-auto text-[11px] sm:text-sm leading-relaxed max-w-full ${isDarkMode ? 'bg-black text-green-400' : 'bg-gray-900 text-green-300'}`}>
{`createMarket(..., priceFeed, priceThreshold)
  └─ Market created with PRICE_FEED type

[Staking phase - users stake on options]

endMarket(id)
  └─ block.timestamp >= market.endTime
  └─ Market state → Ended

[Wait for resolutionEndTime]

resolvePriceFeedMarket(id)
  └─ Reads feed.latestRoundData()
  └─ Compares: price >= threshold ? Option 1 : Option 2
  └─ Market state → Resolved
  └─ Winners can claim payouts`}
                </pre>
              </div>

              <h2 id="price-feed-use-cases" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="price-feed-use-cases">Use Cases</HeadingLink>
              </h2>
              <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                Price Feed markets are ideal for:
              </p>
              <ul className={`list-disc list-outside pl-5 space-y-3 mb-6 ${proseMuted}`}>
                <li><strong>Price predictions:</strong> "Will ETH be above $3000 by end of month?"</li>
                <li><strong>Market movements:</strong> "Will BTC drop below $40,000 this week?"</li>
                <li><strong>Volatility bets:</strong> "Will SOL/USD move more than 10% today?"</li>
                <li><strong>Any objective metric:</strong> Questions with clear, on-chain verifiable answers</li>
              </ul>
              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                These markets provide instant resolution with zero ambiguity, making them perfect for high-frequency trading and automated strategies.
              </p>
              {renderSectionNavigation('price-feed-oracle')}
            </section>

            {/* Building Bots Section */}
            <section 
              id="building-bots" 
              ref={(el) => { sectionRefs.current['building-bots'] = el; }}
              className={`absolute inset-0 flex flex-col px-4 sm:px-6 pb-8 sm:pb-12 pt-16 lg:pt-[100px] transition-all duration-500 overflow-y-auto overflow-x-hidden ${activeSection === 'building-bots' ? 'translate-x-0 opacity-100 z-10' : getSectionTransform('building-bots') + ' opacity-0 z-0 pointer-events-none'}`}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <h1 id="building-bots" className={`font-inter text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-left ${heading1}`}>
                <HeadingLink headingId="building-bots">Building Bots</HeadingLink>
              </h1>
              <p className={`text-lg sm:text-xl leading-relaxed mb-8 sm:mb-12 ${proseLead}`}>
                This guide helps external developers build bots to monitor markets, track wallet activity, and create copy trading systems. All interactions happen directly with the blockchain through the MarketManager contract.
              </p>

              <h2 id="watching-markets" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="watching-markets">Watching for New Markets</HeadingLink>
              </h2>
              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                To monitor when new markets are created, listen for the MarketCreated event emitted by the MarketManager contract. This event contains all the essential market information including the market ID, creator address, IPFS hash for metadata, timing information, and market parameters.
              </p>

              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                When a new market is created, the contract emits a MarketCreated event with the following information:
              </p>
              <ul className={`list-disc list-outside pl-5 space-y-2 mb-6 ${proseMuted}`}>
                <li>Market ID (unique identifier)</li>
                <li>Creator address (who created the market)</li>
                <li>IPFS hash (points to market metadata stored on IPFS)</li>
                <li>Market type (Price Feed or Optimistic Oracle)</li>
                <li>Payment token address (native token or ERC20)</li>
                <li>Timing information (start time, stake end time, market end time, resolution end time)</li>
                <li>Market parameters (minimum stake, max options, etc.)</li>
              </ul>
              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                You can listen to these events in real-time using WebSocket connections to the RPC endpoint, or poll for events using HTTP. The IPFS hash can be used to fetch the full market details including title, description, and images from any IPFS gateway.
              </p>

              <h2 id="wallet-tracking" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="wallet-tracking">Tracking Wallet Activity</HeadingLink>
              </h2>
              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                To track when specific wallets place stakes, listen for the StakePlaced event. This event is emitted every time a user stakes on a market and contains:
              </p>
              <ul className={`list-disc list-outside pl-5 space-y-2 mb-6 ${proseMuted}`}>
                <li>Market ID (which market they staked on)</li>
                <li>User address (the wallet that placed the stake)</li>
                <li>Option ID (which outcome they chose)</li>
                <li>Amount staked (the token amount)</li>
              </ul>
              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                You can filter these events by specific wallet addresses to track the activity of successful traders. This enables building copy trading systems that automatically mirror the trades of profitable wallets.
              </p>

              <h2 id="copy-trading" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="copy-trading">Building a Copy Trading Bot</HeadingLink>
              </h2>
              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                A copy trading bot automatically mirrors the trades of successful wallets. Here's how to build one:
              </p>
              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>1. Identify Successful Traders</h3>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  Query the contract to get historical market data and calculate win rates for different wallets. You can check which markets have been resolved and which wallets won by comparing their staked options to the winning option.
                </p>
              </div>
              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>2. Monitor Their Activity</h3>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  Listen for StakePlaced events filtered by the wallet addresses you want to copy. When they place a stake, your bot receives the market ID, option ID, and stake amount.
                </p>
              </div>
              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>3. Mirror Their Trades</h3>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  When a tracked wallet places a stake, automatically place a stake on the same market with the same option. You can scale the amount proportionally (e.g., copy 50% of their stake amount) or use a fixed amount. Make sure to check that the market is still active and the staking period hasn't ended before placing your stake.
                </p>
              </div>
              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>4. Track Performance</h3>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  Monitor MarketResolved events to track which markets your copied trades won or lost. Calculate your bot's performance and adjust which wallets you copy based on their recent success rates.
                </p>
              </div>
              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                You can also query the contract to check a wallet's historical performance by looking at their past stakes and comparing them to resolved market outcomes. The contract provides view functions to check market states, user stakes, and market pools.
              </p>

              <h2 id="contract-reference" className={`font-inter text-xl sm:text-2xl font-semibold mt-8 sm:mt-12 mb-3 sm:mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="contract-reference">Contract Reference</HeadingLink>
              </h2>
              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                The MarketManager contract provides several events and view functions that bots can use:
              </p>
              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Events</h3>
                <ul className={`list-disc list-outside pl-5 space-y-2 mb-4 ${proseMuted}`}>
                  <li><strong>MarketCreated:</strong> Emitted when a new market is created</li>
                  <li><strong>StakePlaced:</strong> Emitted when a user places a stake</li>
                  <li><strong>MarketResolved:</strong> Emitted when a market is resolved</li>
                  <li><strong>MarketCancelled:</strong> Emitted when a market is cancelled</li>
                  <li><strong>WinningsClaimed:</strong> Emitted when a user claims their winnings</li>
                  <li><strong>RefundClaimed:</strong> Emitted when a user claims a refund</li>
                </ul>
                </div>
              <div className={`mb-6 sm:mb-8 p-4 sm:p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>View Functions</h3>
                <p className={`mb-4 leading-relaxed ${proseMuted}`}>
                  The contract provides view functions to query market data, user stakes, option pools, and market states. These can be called without sending a transaction and are free to use. Check the contract ABI for the complete list of available functions and their parameters.
                </p>
              </div>
              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                All interactions with the platform happen directly on-chain. There are no off-chain APIs or centralized services required. You can build bots using any blockchain library that supports the Pepe Unchained network.
              </p>

              {renderSectionNavigation('building-bots')}
            </section>

            {/* Contract Reference Section */}
            <section 
              id="contract-reference" 
              ref={(el) => { sectionRefs.current['contract-reference'] = el; }}
              className={`absolute inset-0 flex flex-col px-4 sm:px-6 pb-8 sm:pb-12 pt-16 lg:pt-[100px] transition-all duration-500 overflow-y-auto overflow-x-hidden ${activeSection === 'contract-reference' ? 'translate-x-0 opacity-100 z-10' : getSectionTransform('contract-reference') + ' opacity-0 z-0 pointer-events-none'}`}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <h1 id="contract-reference" className={`font-inter text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-left ${heading1}`}>
                <HeadingLink headingId="contract-reference">Contract Reference</HeadingLink>
              </h1>
              <p className={`text-lg sm:text-xl leading-relaxed mb-8 sm:mb-12 ${proseLead}`}>
                Complete reference for interacting with the MarketManager contract.
              </p>
              <p className={`mb-6 leading-relaxed ${proseMuted}`}>
                The MarketManager contract is deployed on Pepe Unchained and provides all the functions needed to create markets, place stakes, resolve markets, and claim winnings. All interactions are on-chain and require no centralized services.
              </p>
              {renderSectionNavigation('contract-reference')}
            </section>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
