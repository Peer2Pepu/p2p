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

  const HeadingLink = ({ headingId, children, className = '' }: { headingId: string; children: React.ReactNode; className?: string }) => (
    <a 
      href={`#${headingId}`} 
      onClick={(e) => copyHeadingUrl(e, headingId)} 
      className={`font-inter no-underline hover:text-[#39FF14] transition-colors cursor-pointer inline-flex items-center gap-2 group ${className}`}
    >
      {children}
      <LinkIcon className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
    </a>
  );

  const renderSectionNavigation = (sectionId: string) => {
    const currentSection = SECTIONS.find(s => s.id === sectionId);
    if (!currentSection) return null;

    return (
      <div className={`mt-auto pt-12 border-t ${isDarkMode ? 'border-[#39FF14]/20' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          {currentSection.prev ? (
            <button
              onClick={() => navigateToSection(currentSection.prev!)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'hover:bg-[#39FF14]/10 text-white/80 hover:text-[#39FF14]' 
                  : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
              }`}
            >
              <ChevronLeft size={18} />
              Previous: {SECTIONS.find(s => s.id === currentSection.prev)?.title}
            </button>
          ) : (
            <div></div>
          )}
          {currentSection.next && (
            <button
              onClick={() => navigateToSection(currentSection.next!)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'hover:bg-[#39FF14]/10 text-white/80 hover:text-[#39FF14]' 
                  : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
              }`}
            >
              Next: {SECTIONS.find(s => s.id === currentSection.next)?.title}
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`${inter.variable} min-h-screen ${isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'}`}>
      {/* Mobile Sidebar Toggle */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-sm ${isDarkMode ? 'bg-black border-[#39FF14]/20' : 'bg-[#F5F3F0] border-gray-200'} lg:hidden`}>
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-[#39FF14]/10 text-white' : 'hover:bg-gray-200'}`}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Documentation</h1>
          <div className="w-10" />
        </div>
      </header>

      <div className="flex">
        {/* Docs Sidebar */}
        <aside className={`
          fixed lg:sticky top-0 h-screen overflow-y-auto z-30
          ${isDarkMode ? 'bg-black border-r border-[#39FF14]/20' : 'bg-white border-r border-gray-200'}
          w-64 flex-shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          transition-transform duration-300
        `}>
          <div className="p-4 border-b border-[#39FF14]/20">
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.png"
                alt="Peer2Pepu Logo"
                width={180}
                height={60}
                className="object-contain"
                priority
              />
            </Link>
          </div>

          <div className="p-6">
            <nav className="space-y-1">
              {SECTIONS.map((section) => {
                const isActive = activeSection === section.id;
                return (
              <button
                    key={section.id}
                    onClick={() => navigateToSection(section.id)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
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
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
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
            className="h-screen overflow-hidden relative"
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
            <div className="max-w-4xl mx-auto h-full relative">
            {/* Overview Section */}
            <section 
              id="overview" 
              ref={(el) => { sectionRefs.current['overview'] = el; }}
              className={`absolute inset-0 flex flex-col px-6 py-12 transition-all duration-500 overflow-y-auto ${activeSection === 'overview' ? 'translate-x-0 opacity-100 z-10' : '-translate-x-full opacity-0 z-0 pointer-events-none'}`}
              style={{ 
                paddingTop: '100px',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <h1 id="overview" className={`font-inter text-3xl font-bold mb-6 text-left group ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#overview" onClick={(e) => copyHeadingUrl(e, 'overview')} className="no-underline hover:text-[#39FF14] transition-colors cursor-pointer inline-flex items-center gap-2">
                  Overview
                  <LinkIcon className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                </a>
              </h1>

              <p className={`text-xl leading-relaxed mb-12 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Welcome to the P2P Prediction Markets platform documentation. This comprehensive guide will help you understand how to create, participate in, and interact with decentralized prediction markets on the Pepe Unchained blockchain.
              </p>

              <h2 id="what-are-prediction-markets" className={`font-inter text-2xl font-semibold mt-12 mb-4 text-left group ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#what-are-prediction-markets" onClick={(e) => copyHeadingUrl(e, 'what-are-prediction-markets')} className="no-underline hover:text-[#39FF14] transition-colors cursor-pointer inline-flex items-center gap-2">
                  What are Prediction Markets?
                  <LinkIcon className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                </a>
              </h2>
              <p className={`mb-6 leading-relaxed text-lg ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Prediction markets are decentralized platforms where participants can stake tokens on the outcome of future events. Unlike traditional betting, prediction markets aggregate collective knowledge and provide financial incentives for accurate predictions. They serve multiple purposes including information aggregation, price discovery, and risk management.
              </p>
              <p className={`mb-6 leading-relaxed text-lg ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                In a prediction market, users stake tokens on their preferred outcome. The market price of each outcome reflects the collective belief about its probability. When the event resolves, winners receive payouts proportional to their stake and the total pool, while losers forfeit their staked tokens.
              </p>

              <h2 id="key-features" className={`font-inter text-2xl font-semibold mt-12 mb-4 text-left group ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#key-features" onClick={(e) => copyHeadingUrl(e, 'key-features')} className="no-underline hover:text-[#39FF14] transition-colors cursor-pointer inline-flex items-center gap-2">
                  Key Features
                  <LinkIcon className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                </a>
              </h2>
              <ul className={`list-disc list-inside space-y-3 mb-8 text-lg ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
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
              className={`absolute inset-0 flex flex-col px-6 py-12 transition-all duration-500 overflow-y-auto ${activeSection === 'getting-started' ? 'translate-x-0 opacity-100 z-10' : getSectionTransform('getting-started') + ' opacity-0 z-0 pointer-events-none'}`}
              style={{ 
                paddingTop: '100px',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <h1 id="getting-started" className={`font-inter text-3xl font-bold mb-6 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="getting-started">Getting Started</HeadingLink>
              </h1>
              <p className={`text-xl leading-relaxed mb-12 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Learn how to create and participate in prediction markets on the P2P platform.
              </p>

              <h2 id="market-creation" className={`font-inter text-2xl font-semibold mt-12 mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="market-creation">Creating a Market</HeadingLink>
              </h2>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Creating a prediction market requires several steps. First, the creator defines the event or question that the market will resolve. This includes writing a clear title, detailed description, and providing relevant resources or links that help participants make informed decisions.
              </p>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                The creator must choose between two resolution mechanisms: Price Feed markets for objective price-based questions, or Optimistic Oracle markets for subjective events requiring human judgment. They set the market duration, staking period, and resolution timeframe. A creator deposit is required to ensure commitment, and creators can optionally stake on their preferred outcome.
              </p>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                For Price Feed markets, the creator selects a price feed (ETH/USD, BTC/USD, SOL/USD, or PEPU/USD) and sets a threshold. The market will automatically resolve based on whether the price is above or below this threshold at resolution time. For Optimistic Oracle markets, the creator defines options (Yes/No for binary, or multiple options) and the market requires manual resolution through the oracle system.
              </p>

              {renderSectionNavigation('getting-started')}
            </section>

            {/* Participating Section */}
            <section 
              id="participating" 
              ref={(el) => { sectionRefs.current['participating'] = el; }}
              className={`absolute inset-0 flex flex-col px-6 py-12 transition-all duration-500 overflow-y-auto ${activeSection === 'participating' ? 'translate-x-0 opacity-100 z-10' : getSectionTransform('participating') + ' opacity-0 z-0 pointer-events-none'}`}
              style={{ 
                paddingTop: '100px',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <h1 id="participating" className={`font-inter text-3xl font-bold mb-6 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="participating">Participating in Markets</HeadingLink>
              </h1>
              <p className={`text-xl leading-relaxed mb-12 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Learn how to stake on markets, understand the resolution process, and claim your winnings.
              </p>

              <h2 id="staking-phase" className={`font-inter text-2xl font-semibold mt-12 mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="staking-phase">Staking Phase</HeadingLink>
              </h2>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Once a market is created, it enters the staking phase. During this period, any user can stake tokens on their preferred outcome. The amount you stake determines your potential payout if your chosen outcome wins. The payout ratio is calculated based on the total pool and the proportion of stakes on the winning option.
              </p>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Staking requires meeting the minimum stake amount set by the market creator. You can stake using the payment token specified by the creator, which may be native PEPU tokens or any supported ERC20 token. The platform supports multiple tokens to provide flexibility and accessibility.
              </p>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                The staking phase ends at the specified stake end time. After this point, no new stakes can be placed, but the market remains active until the end time is reached. This allows for a period where the market is closed to new participants but hasn't yet ended.
              </p>

              <h2 id="market-end" className={`font-inter text-2xl font-semibold mt-12 mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="market-end">Market End</HeadingLink>
              </h2>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                When the market end time is reached, the market automatically transitions to the "Ended" state. Once ended, the market is locked and no further stakes can be placed.
              </p>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                The market remains in the Ended state until resolution occurs. For Price Feed markets, resolution happens automatically after the resolution end time. For Optimistic Oracle markets, resolution requires an assertion to be made and the liveness period to pass.
              </p>

              <h2 id="resolution" className={`font-inter text-2xl font-semibold mt-12 mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="resolution">Resolution</HeadingLink>
              </h2>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Resolution is the process of determining the winning outcome. For Price Feed markets, resolution is automatic. When the resolution end time is reached, the system queries the on-chain price feed and compares it to the threshold. If the price is greater than or equal to the threshold, Option 1 (Yes) wins. Otherwise, Option 2 (No) wins.
              </p>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                For Optimistic Oracle markets, resolution is more complex. Any user can make an assertion about which outcome should win. This assertion includes a bond (stake) that can be challenged during the liveness period. If no one disputes the assertion within the liveness period, the market can be settled with the asserted outcome. If disputed, the matter goes to the Decentralized Voting Mechanism (DVM) for final resolution.
              </p>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                The liveness period is a configurable time window (default 2 hours) during which assertions can be challenged. This provides security and ensures that incorrect assertions can be disputed before final settlement.
              </p>

              <h2 id="payouts" className={`font-inter text-2xl font-semibold mt-12 mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="payouts">Claiming Payouts</HeadingLink>
              </h2>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Once a market is resolved, winners can claim their payouts. The payout calculation is based on the total pool size and the proportion of stakes on the winning option. If you staked on the winning outcome, you receive a share of the total pool proportional to your stake.
              </p>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                A small platform fee is deducted from the total pool before payouts are distributed. This fee supports the ecosystem, including infrastructure costs, development, and platform sustainability. The fee structure is transparent and visible when creating or participating in markets.
              </p>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Users who staked on losing options do not receive any payout. Their staked tokens become part of the winning pool. This creates an incentive structure where accurate predictions are rewarded, and the market naturally aggregates information through price discovery.
              </p>

              {renderSectionNavigation('participating')}
            </section>

            {/* Market Types Section */}
            <section 
              id="market-types" 
              ref={(el) => { sectionRefs.current['market-types'] = el; }}
              className={`absolute inset-0 flex flex-col px-6 py-12 transition-all duration-500 overflow-y-auto ${activeSection === 'market-types' ? 'translate-x-0 opacity-100 z-10' : getSectionTransform('market-types') + ' opacity-0 z-0 pointer-events-none'}`}
              style={{ 
                paddingTop: '100px',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <h1 id="market-types" className={`font-inter text-3xl font-bold mb-6 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="market-types">Market Types</HeadingLink>
              </h1>
              <p className={`text-xl leading-relaxed mb-12 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Understand the different types of markets available and when to use each one.
              </p>

              <h2 id="price-feed-markets" className={`font-inter text-2xl font-semibold mt-12 mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="price-feed-markets">Price Feed Markets</HeadingLink>
              </h2>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Price Feed markets are binary (Yes/No) markets that automatically resolve based on on-chain price data. These markets are perfect for objective, price-based questions where the outcome can be definitively determined by querying a price feed contract.
              </p>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                When creating a Price Feed market, you select one of the available price feeds: ETH/USD, BTC/USD, SOL/USD, or PEPU/USD. You then set a price threshold and choose whether "Yes" wins if the price is above the threshold (Over) or below the threshold (Under). The market automatically resolves when the resolution time is reached by comparing the current price from the feed against your threshold.
              </p>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                These markets are ideal for questions like "Will ETH be above $3000 by end of month?" or "Will BTC drop below $40,000 this week?" The resolution is trustless and automatic, requiring no human judgment or oracle intervention beyond the price feed itself.
              </p>

              <h2 id="optimistic-oracle-markets" className={`font-inter text-2xl font-semibold mt-12 mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="optimistic-oracle-markets">Optimistic Oracle Markets</HeadingLink>
              </h2>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Optimistic Oracle markets support both binary and multi-option outcomes. These markets are designed for subjective events or complex questions that require human judgment to resolve. Examples include sports outcomes, election results, product launches, or any event where the outcome cannot be determined purely from on-chain data.
              </p>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Resolution for Optimistic Oracle markets follows a specific process. After the market ends, any user can make an assertion about which outcome should win. This assertion includes posting a bond (stake) that can be challenged. During the liveness period (typically 2 hours), anyone can dispute the assertion by posting their own bond. If disputed, the matter goes to the Decentralized Voting Mechanism for token-holder voting.
              </p>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                If no dispute occurs during the liveness period, the market can be settled with the asserted outcome. This optimistic approach allows for fast resolution when assertions are correct, while the dispute mechanism provides security against incorrect assertions.
              </p>

              {renderSectionNavigation('market-types')}
            </section>

            {/* Optimistic Oracle Section */}
            <section 
              id="optimistic-oracle" 
              ref={(el) => { sectionRefs.current['optimistic-oracle'] = el; }}
              className={`absolute inset-0 flex flex-col px-6 py-12 transition-all duration-500 overflow-y-auto ${activeSection === 'optimistic-oracle' ? 'translate-x-0 opacity-100 z-10' : getSectionTransform('optimistic-oracle') + ' opacity-0 z-0 pointer-events-none'}`}
              style={{ 
                paddingTop: '100px',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <h1 id="optimistic-oracle" className={`font-inter text-3xl font-bold mb-6 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="optimistic-oracle">P2P Optimistic Oracle</HeadingLink>
              </h1>
              <p className={`text-xl leading-relaxed mb-12 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                The P2P Optimistic Oracle provides a decentralized mechanism for resolving subjective events in prediction markets. It uses an optimistic approach where assertions are assumed correct unless challenged, enabling fast resolution while maintaining security through dispute mechanisms and token-weighted voting.
              </p>

              <h2 id="how-optimistic-works" className={`font-inter text-2xl font-semibold mt-12 mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="how-optimistic-works">How It Works</HeadingLink>
              </h2>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                The Optimistic Oracle resolution process consists of four main steps:
              </p>

              <div className={`mb-8 p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Step 1: Assert</h3>
                <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  After a market ends, any user (except the creator) who has staked on the market can make an assertion about which outcome should win. The asserter must:
                </p>
                <ul className={`list-disc list-inside space-y-2 mb-4 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  <li>Post a bond (stake) to the oracle contract</li>
                  <li>Provide a human-readable claim describing the outcome</li>
                  <li>Encode the winning option ID in callback data</li>
                </ul>
                <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  Once asserted, a 48-hour dispute window begins. If no one disputes during this period, the assertion is automatically accepted.
                </p>
              </div>

              <div className={`mb-8 p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Step 2: Dispute (Optional)</h3>
                <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  Anyone who disagrees with the assertion can dispute it within the dispute window by:
                </p>
                <ul className={`list-disc list-inside space-y-2 mb-4 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  <li>Posting an equal bond to challenge the assertion</li>
                  <li>Specifying which option they believe is correct</li>
                  <li>Triggering a vote in the P2PVoting contract</li>
                </ul>
                <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  When disputed, the matter goes to token-weighted voting where P2P token holders vote to accept or reject the assertion.
                </p>
              </div>

              <div className={`mb-8 p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Step 3: Settle</h3>
                <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  After the expiration period, anyone can call <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>settleOracle()</code> to finalize the result:
                </p>
                <ul className={`list-disc list-inside space-y-2 mb-4 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  <li><strong>No dispute:</strong> Assertion accepted, asserter gets bond back</li>
                  <li><strong>Disputed:</strong> Oracle resolves the vote - majority wins both bonds</li>
                  <li><strong>No consensus:</strong> Assertion automatically accepted (fallback)</li>
                </ul>
              </div>

              <div className={`mb-8 p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Step 4: Resolve</h3>
                <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  Finally, call <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>resolveP2PMarket()</code> to read the oracle result:
                </p>
                <ul className={`list-disc list-inside space-y-2 mb-4 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  <li><strong>Result = true:</strong> Market resolves with the asserted option, winners can claim payouts</li>
                  <li><strong>Result = false:</strong> Market cancels, all stakers can claim refunds (assertion was wrong)</li>
                </ul>
              </div>

              <h2 id="optimistic-flow" className={`font-inter text-2xl font-semibold mt-12 mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="optimistic-flow">Resolution Flow</HeadingLink>
              </h2>

              <div className={`mb-8 p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Normal Flow (No Dispute)</h3>
                <pre className={`p-4 rounded overflow-x-auto text-sm ${isDarkMode ? 'bg-black text-green-400' : 'bg-gray-900 text-green-300'}`}>
{`endMarket(id)
  └─ block.timestamp >= market.endTime

requestP2PResolution(id, optionId, claim)
  └─ asserter posts bond, oracle stores claim + callbackData

[48h grace period — no dispute filed]

settleOracle(id)
  └─ oracle sees no disputer → accepts assertion

resolveP2PMarket(id)
  └─ reads result=true, decodes optionId
  └─ market resolves, winnings claimable`}
                </pre>
                </div>

              <div className={`mb-8 p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Disputed Flow (Vote Required)</h3>
                <pre className={`p-4 rounded overflow-x-auto text-sm ${isDarkMode ? 'bg-black text-green-400' : 'bg-gray-900 text-green-300'}`}>
{`endMarket(id)
requestP2PResolution(id, optionId, claim)

[within dispute window]
disputeOracle(id)
  └─ disputer posts equal bond
  └─ oracle creates vote request in P2PVoting
  └─ P2P token holders vote 1=accept / 2=reject

[after vote deadline]
settleOracle(id)
  └─ oracle resolves the vote, finds majority
  └─ If majority voted 1: asserter wins, gets both bonds
  └─ If majority voted 2: disputer wins, gets both bonds

resolveP2PMarket(id)
  └─ result=true  → market resolves with asserted option
  └─ result=false → market CANCELS, refunds available`}
                </pre>
              </div>

              <h2 id="optimistic-fallback" className={`font-inter text-2xl font-semibold mt-12 mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="optimistic-fallback">Fallback Mechanisms</HeadingLink>
              </h2>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                The system includes several safety mechanisms to prevent permanent fund lock:
              </p>
              <ul className={`list-disc list-inside space-y-3 mb-6 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                <li><strong>No Assertion Grace Period:</strong> If no one asserts within 48 hours after market end, <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>cancelMarketNoAssertion()</code> can be called to cancel the market and allow refunds.</li>
                <li><strong>Assertion Rejected:</strong> If the oracle settles with <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>result=false</code>, the market cancels and all stakers can claim refunds.</li>
                <li><strong>No Consensus:</strong> If voting has low turnout or no clear majority, the oracle automatically accepts the assertion as true.</li>
              </ul>
              {renderSectionNavigation('optimistic-oracle')}
            </section>

            {/* Price Feeds Section */}
            <section 
              id="price-feed-oracle" 
              ref={(el) => { sectionRefs.current['price-feed-oracle'] = el; }}
              className={`absolute inset-0 flex flex-col px-6 py-12 transition-all duration-500 overflow-y-auto ${activeSection === 'price-feed-oracle' ? 'translate-x-0 opacity-100 z-10' : getSectionTransform('price-feed-oracle') + ' opacity-0 z-0 pointer-events-none'}`}
              style={{ 
                paddingTop: '100px',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <h1 id="price-feed-oracle" className={`font-inter text-3xl font-bold mb-6 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="price-feed-oracle">Price Feed Oracle</HeadingLink>
              </h1>
              <p className={`text-xl leading-relaxed mb-12 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Price Feed markets use on-chain price data for automatic, trustless resolution. These markets are perfect for objective, price-based questions where the outcome can be definitively determined by querying a Chainlink-compatible price feed contract.
              </p>

              <h2 id="how-price-feed-works" className={`font-inter text-2xl font-semibold mt-12 mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="how-price-feed-works">How It Works</HeadingLink>
              </h2>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Price Feed markets resolve automatically in a single transaction:
              </p>

              <div className={`mb-8 p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>1. Market Creation</h3>
                <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  When creating a Price Feed market, the creator must:
                </p>
                <ul className={`list-disc list-inside space-y-2 mb-4 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  <li>Select a price feed contract (ETH/USD, BTC/USD, SOL/USD, or PEPU/USD)</li>
                  <li>Set a price threshold value</li>
                  <li>Define the resolution end time</li>
                </ul>
              </div>

              <div className={`mb-8 p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>2. Market End</h3>
                <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  When the market end time is reached, anyone can call <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>endMarket()</code> to transition the market to the "Ended" state. This is typically handled automatically by bots.
                </p>
              </div>

              <div className={`mb-8 p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>3. Resolution</h3>
                <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  After the resolution end time, anyone can call <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>resolvePriceFeedMarket()</code>. The contract:
                </p>
                <ol className={`list-decimal list-inside space-y-2 mb-4 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  <li>Queries the price feed: <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>feed.latestRoundData()</code></li>
                  <li>Compares price to threshold: <code className={`px-2 py-1 rounded ${isDarkMode ? 'bg-gray-800 text-[#39FF14]' : 'bg-gray-200 text-gray-900'}`}>price &gt;= threshold ? Option 1 : Option 2</code></li>
                  <li>Sets the winning option and marks market as resolved</li>
                  <li>Distributes fees and enables winners to claim payouts</li>
                </ol>
                <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  <strong>Resolution is instant</strong> — no voting, no disputes, no waiting periods. The outcome is determined purely by on-chain data.
                </p>
                </div>

              <h2 id="price-feed-flow" className={`font-inter text-2xl font-semibold mt-12 mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="price-feed-flow">Resolution Flow</HeadingLink>
              </h2>

              <div className={`mb-8 p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <pre className={`p-4 rounded overflow-x-auto text-sm ${isDarkMode ? 'bg-black text-green-400' : 'bg-gray-900 text-green-300'}`}>
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

              <h2 id="price-feed-use-cases" className={`font-inter text-2xl font-semibold mt-12 mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="price-feed-use-cases">Use Cases</HeadingLink>
              </h2>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Price Feed markets are ideal for:
              </p>
              <ul className={`list-disc list-inside space-y-3 mb-6 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                <li><strong>Price predictions:</strong> "Will ETH be above $3000 by end of month?"</li>
                <li><strong>Market movements:</strong> "Will BTC drop below $40,000 this week?"</li>
                <li><strong>Volatility bets:</strong> "Will SOL/USD move more than 10% today?"</li>
                <li><strong>Any objective metric:</strong> Questions with clear, on-chain verifiable answers</li>
              </ul>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                These markets provide instant resolution with zero ambiguity, making them perfect for high-frequency trading and automated strategies.
              </p>
              {renderSectionNavigation('price-feed-oracle')}
            </section>

            {/* Building Bots Section */}
            <section 
              id="building-bots" 
              ref={(el) => { sectionRefs.current['building-bots'] = el; }}
              className={`absolute inset-0 flex flex-col px-6 py-12 transition-all duration-500 overflow-y-auto ${activeSection === 'building-bots' ? 'translate-x-0 opacity-100 z-10' : getSectionTransform('building-bots') + ' opacity-0 z-0 pointer-events-none'}`}
              style={{ 
                paddingTop: '100px',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <h1 id="building-bots" className={`font-inter text-3xl font-bold mb-6 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="building-bots">Building Bots</HeadingLink>
              </h1>
              <p className={`text-xl leading-relaxed mb-12 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                This guide helps external developers build bots to monitor markets, track wallet activity, and create copy trading systems. All interactions happen directly with the blockchain through the MarketManager contract.
              </p>

              <h2 id="watching-markets" className={`font-inter text-2xl font-semibold mt-12 mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="watching-markets">Watching for New Markets</HeadingLink>
              </h2>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                To monitor when new markets are created, listen for the MarketCreated event emitted by the MarketManager contract. This event contains all the essential market information including the market ID, creator address, IPFS hash for metadata, timing information, and market parameters.
              </p>

              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                When a new market is created, the contract emits a MarketCreated event with the following information:
              </p>
              <ul className={`list-disc list-inside space-y-2 mb-6 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                <li>Market ID (unique identifier)</li>
                <li>Creator address (who created the market)</li>
                <li>IPFS hash (points to market metadata stored on IPFS)</li>
                <li>Market type (Price Feed or Optimistic Oracle)</li>
                <li>Payment token address (native token or ERC20)</li>
                <li>Timing information (start time, stake end time, market end time, resolution end time)</li>
                <li>Market parameters (minimum stake, max options, etc.)</li>
              </ul>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                You can listen to these events in real-time using WebSocket connections to the RPC endpoint, or poll for events using HTTP. The IPFS hash can be used to fetch the full market details including title, description, and images from any IPFS gateway.
              </p>

              <h2 id="wallet-tracking" className={`font-inter text-2xl font-semibold mt-12 mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="wallet-tracking">Tracking Wallet Activity</HeadingLink>
              </h2>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                To track when specific wallets place stakes, listen for the StakePlaced event. This event is emitted every time a user stakes on a market and contains:
              </p>
              <ul className={`list-disc list-inside space-y-2 mb-6 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                <li>Market ID (which market they staked on)</li>
                <li>User address (the wallet that placed the stake)</li>
                <li>Option ID (which outcome they chose)</li>
                <li>Amount staked (the token amount)</li>
              </ul>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                You can filter these events by specific wallet addresses to track the activity of successful traders. This enables building copy trading systems that automatically mirror the trades of profitable wallets.
              </p>

              <h2 id="copy-trading" className={`font-inter text-2xl font-semibold mt-12 mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="copy-trading">Building a Copy Trading Bot</HeadingLink>
              </h2>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                A copy trading bot automatically mirrors the trades of successful wallets. Here's how to build one:
              </p>
              <div className={`mb-8 p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>1. Identify Successful Traders</h3>
                <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  Query the contract to get historical market data and calculate win rates for different wallets. You can check which markets have been resolved and which wallets won by comparing their staked options to the winning option.
                </p>
              </div>
              <div className={`mb-8 p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>2. Monitor Their Activity</h3>
                <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  Listen for StakePlaced events filtered by the wallet addresses you want to copy. When they place a stake, your bot receives the market ID, option ID, and stake amount.
                </p>
              </div>
              <div className={`mb-8 p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>3. Mirror Their Trades</h3>
                <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  When a tracked wallet places a stake, automatically place a stake on the same market with the same option. You can scale the amount proportionally (e.g., copy 50% of their stake amount) or use a fixed amount. Make sure to check that the market is still active and the staking period hasn't ended before placing your stake.
                </p>
              </div>
              <div className={`mb-8 p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>4. Track Performance</h3>
                <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  Monitor MarketResolved events to track which markets your copied trades won or lost. Calculate your bot's performance and adjust which wallets you copy based on their recent success rates.
                </p>
              </div>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                You can also query the contract to check a wallet's historical performance by looking at their past stakes and comparing them to resolved market outcomes. The contract provides view functions to check market states, user stakes, and market pools.
              </p>

              <h2 id="contract-reference" className={`font-inter text-2xl font-semibold mt-12 mb-4 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="contract-reference">Contract Reference</HeadingLink>
              </h2>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                The MarketManager contract provides several events and view functions that bots can use:
              </p>
              <div className={`mb-8 p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Events</h3>
                <ul className={`list-disc list-inside space-y-2 mb-4 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  <li><strong>MarketCreated:</strong> Emitted when a new market is created</li>
                  <li><strong>StakePlaced:</strong> Emitted when a user places a stake</li>
                  <li><strong>MarketResolved:</strong> Emitted when a market is resolved</li>
                  <li><strong>MarketCancelled:</strong> Emitted when a market is cancelled</li>
                  <li><strong>WinningsClaimed:</strong> Emitted when a user claims their winnings</li>
                  <li><strong>RefundClaimed:</strong> Emitted when a user claims a refund</li>
                </ul>
                </div>
              <div className={`mb-8 p-6 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-[#39FF14]/30' : 'bg-gray-50 border-gray-300'}`}>
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>View Functions</h3>
                <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                  The contract provides view functions to query market data, user stakes, option pools, and market states. These can be called without sending a transaction and are free to use. Check the contract ABI for the complete list of available functions and their parameters.
                </p>
              </div>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                All interactions with the platform happen directly on-chain. There are no off-chain APIs or centralized services required. You can build bots using any blockchain library that supports the Pepe Unchained network.
              </p>

              {renderSectionNavigation('building-bots')}
            </section>

            {/* Contract Reference Section */}
            <section 
              id="contract-reference" 
              ref={(el) => { sectionRefs.current['contract-reference'] = el; }}
              className={`absolute inset-0 flex flex-col px-6 py-12 transition-all duration-500 overflow-y-auto ${activeSection === 'contract-reference' ? 'translate-x-0 opacity-100 z-10' : getSectionTransform('contract-reference') + ' opacity-0 z-0 pointer-events-none'}`}
              style={{ 
                paddingTop: '100px',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <h1 id="contract-reference" className={`font-inter text-3xl font-bold mb-6 text-left ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <HeadingLink headingId="contract-reference">Contract Reference</HeadingLink>
              </h1>
              <p className={`text-xl leading-relaxed mb-12 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Complete reference for interacting with the MarketManager contract.
              </p>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
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
