"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Sun,
  Moon,
  Menu,
  X,
  Search,
  ChevronRight
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useTheme } from '../context/ThemeContext';

export default function DocsPage() {
  const { isDarkMode, toggleTheme } = useTheme();
  const { address, isConnected } = useAccount();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    oracles: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setSidebarOpen(false);
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-black' : 'bg-[#F5F3F0]'}`}>
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
              <button
                onClick={() => scrollToSection('overview')}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  isDarkMode 
                    ? 'hover:bg-[#39FF14]/10 text-white/80 hover:text-[#39FF14]' 
                    : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
                }`}
              >
                Overview
              </button>

              <div>
                <button
                  onClick={() => toggleSection('oracles')}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center justify-between ${
                    isDarkMode 
                      ? 'hover:bg-[#39FF14]/10 text-white/80 hover:text-[#39FF14]' 
                      : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
                  }`}
                >
                  <span>Oracles</span>
                  <span className={`text-xs transition-transform ${expandedSections.oracles ? 'rotate-90' : ''}`}>›</span>
                </button>
                {expandedSections.oracles && (
                  <div className="ml-4 space-y-1 border-l border-[#39FF14]/30 pl-2">
                    <button
                      onClick={() => scrollToSection('optimistic-oracle')}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        isDarkMode 
                          ? 'hover:bg-[#39FF14]/10 text-white/60 hover:text-[#39FF14]' 
                          : 'hover:bg-gray-100 text-gray-600 hover:text-gray-700'
                      }`}
                    >
                      Optimistic Oracle
                    </button>
                    <button
                      onClick={() => scrollToSection('price-feeds')}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        isDarkMode 
                          ? 'hover:bg-[#39FF14]/10 text-white/60 hover:text-[#39FF14]' 
                          : 'hover:bg-gray-100 text-gray-600 hover:text-gray-700'
                      }`}
                    >
                      Price Feeds
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => scrollToSection('bots')}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  isDarkMode 
                    ? 'hover:bg-[#39FF14]/10 text-white/80 hover:text-[#39FF14]' 
                    : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
                }`}
              >
                Bots & Integration
              </button>
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
        <main className="flex-1 min-w-0">
          {/* Desktop Header */}
          <header className={`hidden lg:block sticky top-0 z-30 border-b backdrop-blur-sm ${isDarkMode ? 'bg-black border-[#39FF14]/20' : 'bg-[#F5F3F0] border-gray-200'}`}>
            <div className="px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 max-w-2xl">
                  <div className={`relative ${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-lg border ${isDarkMode ? 'border-[#39FF14]/30' : 'border-gray-300'}`}>
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${isDarkMode ? 'text-white/50' : 'text-gray-400'}`} />
                    <input
                      type="text"
                      placeholder="Search documentation..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full pl-10 pr-4 py-2.5 bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-[#39FF14] rounded-lg ${
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

          <div className="max-w-4xl mx-auto px-6 py-12">
            {/* Overview Section */}
            <section id="overview" className="mb-24 scroll-mt-8">
              <h1 className={`text-5xl font-bold mb-8 group flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#overview" className="no-underline hover:text-[#39FF14] transition-colors flex items-center gap-3">
                  <span className="opacity-0 group-hover:opacity-100 text-[#39FF14] transition-opacity text-3xl">#</span>
                  <span>Overview</span>
                </a>
              </h1>

              <p className={`text-xl leading-relaxed mb-12 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Welcome to the P2P Prediction Markets platform documentation. This comprehensive guide will help you understand how to create, participate in, and interact with decentralized prediction markets on the Pepe Unchained blockchain.
              </p>

              <h2 className={`text-4xl font-semibold mt-16 mb-6 group flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#what-are-prediction-markets" className="no-underline hover:text-[#39FF14] transition-colors flex items-center gap-3">
                  <span className="opacity-0 group-hover:opacity-100 text-[#39FF14] transition-opacity">#</span>
                  <span>What are Prediction Markets?</span>
                </a>
              </h2>
              <p className={`mb-6 leading-relaxed text-lg ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Prediction markets are decentralized platforms where participants can stake tokens on the outcome of future events. Unlike traditional betting, prediction markets aggregate collective knowledge and provide financial incentives for accurate predictions. They serve multiple purposes including information aggregation, price discovery, and risk management.
              </p>
              <p className={`mb-6 leading-relaxed text-lg ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                In a prediction market, users stake tokens on their preferred outcome. The market price of each outcome reflects the collective belief about its probability. When the event resolves, winners receive payouts proportional to their stake and the total pool, while losers forfeit their staked tokens.
              </p>

              <h2 className={`text-4xl font-semibold mt-16 mb-6 group flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#how-it-works" className="no-underline hover:text-[#39FF14] transition-colors flex items-center gap-3">
                  <span className="opacity-0 group-hover:opacity-100 text-[#39FF14] transition-opacity">#</span>
                  <span>How It Works</span>
                </a>
              </h2>
              
              <h3 className={`text-2xl font-semibold mt-10 mb-4 group flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#market-creation" className="no-underline hover:text-[#39FF14] transition-colors flex items-center gap-3">
                  <span className="opacity-0 group-hover:opacity-100 text-[#39FF14] transition-opacity">#</span>
                  <span>Market Creation</span>
                </a>
              </h3>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Creating a prediction market requires several steps. First, the creator defines the event or question that the market will resolve. This includes writing a clear title, detailed description, and providing relevant resources or links that help participants make informed decisions.
              </p>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                The creator must choose between two resolution mechanisms: Price Feed markets for objective price-based questions, or Optimistic Oracle markets for subjective events requiring human judgment. They set the market duration, staking period, and resolution timeframe. A creator deposit is required to ensure commitment, and creators can optionally stake on their preferred outcome.
              </p>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                For Price Feed markets, the creator selects a price feed (ETH/USD, BTC/USD, SOL/USD, or PEPU/USD) and sets a threshold. The market will automatically resolve based on whether the price is above or below this threshold at resolution time. For Optimistic Oracle markets, the creator defines options (Yes/No for binary, or multiple options) and the market requires manual resolution through the oracle system.
              </p>

              <h3 className={`text-2xl font-semibold mt-10 mb-4 group flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#staking-phase" className="no-underline hover:text-[#39FF14] transition-colors flex items-center gap-3">
                  <span className="opacity-0 group-hover:opacity-100 text-[#39FF14] transition-opacity">#</span>
                  <span>Staking Phase</span>
                </a>
              </h3>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Once a market is created, it enters the staking phase. During this period, any user can stake tokens on their preferred outcome. The amount you stake determines your potential payout if your chosen outcome wins. The payout ratio is calculated based on the total pool and the proportion of stakes on the winning option.
              </p>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Staking requires meeting the minimum stake amount set by the market creator. You can stake using the payment token specified by the creator, which may be native PEPU tokens or any supported ERC20 token. The platform supports multiple tokens to provide flexibility and accessibility.
              </p>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                The staking phase ends at the specified stake end time. After this point, no new stakes can be placed, but the market remains active until the end time is reached. This allows for a period where the market is closed to new participants but hasn't yet ended.
              </p>

              <h3 className={`text-2xl font-semibold mt-10 mb-4 group flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#market-end" className="no-underline hover:text-[#39FF14] transition-colors flex items-center gap-3">
                  <span className="opacity-0 group-hover:opacity-100 text-[#39FF14] transition-opacity">#</span>
                  <span>Market End</span>
                </a>
              </h3>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                When the market end time is reached, the market automatically transitions to the "Ended" state. This is handled by automated bots that monitor the blockchain and update market states. Once ended, the market is locked and no further stakes can be placed.
              </p>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                The market remains in the Ended state until resolution occurs. For Price Feed markets, resolution happens automatically after the resolution end time. For Optimistic Oracle markets, resolution requires an assertion to be made and the liveness period to pass.
              </p>

              <h3 className={`text-2xl font-semibold mt-10 mb-4 group flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#resolution" className="no-underline hover:text-[#39FF14] transition-colors flex items-center gap-3">
                  <span className="opacity-0 group-hover:opacity-100 text-[#39FF14] transition-opacity">#</span>
                  <span>Resolution</span>
                </a>
              </h3>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Resolution is the process of determining the winning outcome. For Price Feed markets, resolution is automatic. When the resolution end time is reached, the system queries the on-chain price feed and compares it to the threshold. If the price is greater than or equal to the threshold, Option 1 (Yes) wins. Otherwise, Option 2 (No) wins.
              </p>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                For Optimistic Oracle markets, resolution is more complex. Any user can make an assertion about which outcome should win. This assertion includes a bond (stake) that can be challenged during the liveness period. If no one disputes the assertion within the liveness period, the market can be settled with the asserted outcome. If disputed, the matter goes to the Decentralized Voting Mechanism (DVM) for final resolution.
              </p>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                The liveness period is a configurable time window (default 2 hours) during which assertions can be challenged. This provides security and ensures that incorrect assertions can be disputed before final settlement.
              </p>

              <h3 className={`text-2xl font-semibold mt-10 mb-4 group flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#payouts" className="no-underline hover:text-[#39FF14] transition-colors flex items-center gap-3">
                  <span className="opacity-0 group-hover:opacity-100 text-[#39FF14] transition-opacity">#</span>
                  <span>Payouts</span>
                </a>
              </h3>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Once a market is resolved, winners can claim their payouts. The payout calculation is based on the total pool size and the proportion of stakes on the winning option. If you staked on the winning outcome, you receive a share of the total pool proportional to your stake.
              </p>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                A small platform fee is deducted from the total pool before payouts are distributed. This fee supports the ecosystem, including infrastructure costs, development, and platform sustainability. The fee structure is transparent and visible when creating or participating in markets.
              </p>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Users who staked on losing options do not receive any payout. Their staked tokens become part of the winning pool. This creates an incentive structure where accurate predictions are rewarded, and the market naturally aggregates information through price discovery.
              </p>

              <h2 className={`text-4xl font-semibold mt-16 mb-6 group flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#market-types" className="no-underline hover:text-[#39FF14] transition-colors flex items-center gap-3">
                  <span className="opacity-0 group-hover:opacity-100 text-[#39FF14] transition-opacity">#</span>
                  <span>Market Types</span>
                </a>
              </h2>
              
              <h3 className={`text-2xl font-semibold mt-10 mb-4 group flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#price-feed-markets" className="no-underline hover:text-[#39FF14] transition-colors flex items-center gap-3">
                  <span className="opacity-0 group-hover:opacity-100 text-[#39FF14] transition-opacity">#</span>
                  <span>Price Feed Markets</span>
                </a>
              </h3>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Price Feed markets are binary (Yes/No) markets that automatically resolve based on on-chain price data. These markets are perfect for objective, price-based questions where the outcome can be definitively determined by querying a price feed contract.
              </p>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                When creating a Price Feed market, you select one of the available price feeds: ETH/USD, BTC/USD, SOL/USD, or PEPU/USD. You then set a price threshold and choose whether "Yes" wins if the price is above the threshold (Over) or below the threshold (Under). The market automatically resolves when the resolution time is reached by comparing the current price from the feed against your threshold.
              </p>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                These markets are ideal for questions like "Will ETH be above $3000 by end of month?" or "Will BTC drop below $40,000 this week?" The resolution is trustless and automatic, requiring no human judgment or oracle intervention beyond the price feed itself.
              </p>

              <h3 className={`text-2xl font-semibold mt-10 mb-4 group flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#optimistic-oracle-markets" className="no-underline hover:text-[#39FF14] transition-colors flex items-center gap-3">
                  <span className="opacity-0 group-hover:opacity-100 text-[#39FF14] transition-opacity">#</span>
                  <span>Optimistic Oracle Markets</span>
                </a>
              </h3>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Optimistic Oracle markets support both binary and multi-option outcomes. These markets are designed for subjective events or complex questions that require human judgment to resolve. Examples include sports outcomes, election results, product launches, or any event where the outcome cannot be determined purely from on-chain data.
              </p>
              <p className={`mb-4 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Resolution for Optimistic Oracle markets follows a specific process. After the market ends, any user can make an assertion about which outcome should win. This assertion includes posting a bond (stake) that can be challenged. During the liveness period (typically 2 hours), anyone can dispute the assertion by posting their own bond. If disputed, the matter goes to the Decentralized Voting Mechanism for token-holder voting.
              </p>
              <p className={`mb-6 leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                If no dispute occurs during the liveness period, the market can be settled with the asserted outcome. This optimistic approach allows for fast resolution when assertions are correct, while the dispute mechanism provides security against incorrect assertions.
              </p>

              <h2 className={`text-4xl font-semibold mt-16 mb-6 group flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#key-features" className="no-underline hover:text-[#39FF14] transition-colors flex items-center gap-3">
                  <span className="opacity-0 group-hover:opacity-100 text-[#39FF14] transition-opacity">#</span>
                  <span>Key Features</span>
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

              {/* Section Navigation */}
              <div className={`mt-16 pt-8 border-t ${isDarkMode ? 'border-[#39FF14]/20' : 'border-gray-200'}`}>
                <div className="flex items-center justify-end">
                  <a
                    href="#optimistic-oracle"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection('optimistic-oracle');
                    }}
                    className={`flex items-center gap-2 ${isDarkMode ? 'text-white/80 hover:text-[#39FF14]' : 'text-gray-700 hover:text-gray-900'} transition-colors`}
                  >
                    Next: Optimistic Oracle
                    <ChevronRight size={18} />
                  </a>
                </div>
              </div>
            </section>

            {/* Optimistic Oracle Section */}
            <section id="optimistic-oracle" className="mb-24 scroll-mt-8">
              <h1 className={`text-5xl font-bold mb-8 group flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#optimistic-oracle" className="no-underline hover:text-[#39FF14] transition-colors flex items-center gap-3">
                  <span className="opacity-0 group-hover:opacity-100 text-[#39FF14] transition-opacity text-3xl">#</span>
                  <span>Optimistic Oracle</span>
                </a>
              </h1>
              <p className={`text-xl leading-relaxed mb-12 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                The Optimistic Oracle provides a decentralized mechanism for resolving subjective events in prediction markets. It uses an optimistic approach where assertions are assumed correct unless challenged, enabling fast resolution while maintaining security through dispute mechanisms.
              </p>
              <p className={isDarkMode ? 'text-white/70' : 'text-gray-600'}>
                Detailed Optimistic Oracle documentation coming soon...
              </p>
              <div className={`mt-16 pt-8 border-t ${isDarkMode ? 'border-[#39FF14]/20' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <a
                    href="#overview"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection('overview');
                    }}
                    className={`flex items-center gap-2 ${isDarkMode ? 'text-white/80 hover:text-[#39FF14]' : 'text-gray-700 hover:text-gray-900'} transition-colors`}
                  >
                    <ChevronRight size={18} className="rotate-180" />
                    Previous: Overview
                  </a>
                  <a
                    href="#price-feeds"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection('price-feeds');
                    }}
                    className={`flex items-center gap-2 ${isDarkMode ? 'text-white/80 hover:text-[#39FF14]' : 'text-gray-700 hover:text-gray-900'} transition-colors`}
                  >
                    Next: Price Feeds
                    <ChevronRight size={18} />
                  </a>
                </div>
              </div>
            </section>

            {/* Price Feeds Section */}
            <section id="price-feeds" className="mb-24 scroll-mt-8">
              <h1 className={`text-5xl font-bold mb-8 group flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#price-feeds" className="no-underline hover:text-[#39FF14] transition-colors flex items-center gap-3">
                  <span className="opacity-0 group-hover:opacity-100 text-[#39FF14] transition-opacity text-3xl">#</span>
                  <span>Price Feeds</span>
                </a>
              </h1>
              <p className={`text-xl leading-relaxed mb-12 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Price feeds provide on-chain price data for automatic market resolution. Our platform integrates with multiple price feed contracts that follow the Chainlink AggregatorV3Interface standard.
              </p>
              <p className={isDarkMode ? 'text-white/70' : 'text-gray-600'}>
                Detailed Price Feeds documentation coming soon...
              </p>
              <div className={`mt-16 pt-8 border-t ${isDarkMode ? 'border-[#39FF14]/20' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <a
                    href="#optimistic-oracle"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection('optimistic-oracle');
                    }}
                    className={`flex items-center gap-2 ${isDarkMode ? 'text-white/80 hover:text-[#39FF14]' : 'text-gray-700 hover:text-gray-900'} transition-colors`}
                  >
                    <ChevronRight size={18} className="rotate-180" />
                    Previous: Optimistic Oracle
                  </a>
                  <a
                    href="#bots"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection('bots');
                    }}
                    className={`flex items-center gap-2 ${isDarkMode ? 'text-white/80 hover:text-[#39FF14]' : 'text-gray-700 hover:text-gray-900'} transition-colors`}
                  >
                    Next: Bots & Integration
                    <ChevronRight size={18} />
                  </a>
                </div>
              </div>
            </section>

            {/* Bots Section */}
            <section id="bots" className="mb-24 scroll-mt-8">
              <h1 className={`text-5xl font-bold mb-8 group flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <a href="#bots" className="no-underline hover:text-[#39FF14] transition-colors flex items-center gap-3">
                  <span className="opacity-0 group-hover:opacity-100 text-[#39FF14] transition-opacity text-3xl">#</span>
                  <span>Bots & Integration</span>
                </a>
              </h1>
              <p className={`text-xl leading-relaxed mb-12 ${isDarkMode ? 'text-white/80' : 'text-gray-700'}`}>
                Learn how to build bots, integrate with the platform, and automate interactions with prediction markets.
              </p>
              <p className={isDarkMode ? 'text-white/70' : 'text-gray-600'}>
                Detailed Bots & Integration documentation coming soon...
              </p>
              <div className={`mt-16 pt-8 border-t ${isDarkMode ? 'border-[#39FF14]/20' : 'border-gray-200'}`}>
                <div className="flex items-center justify-start">
                  <a
                    href="#price-feeds"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection('price-feeds');
                    }}
                    className={`flex items-center gap-2 ${isDarkMode ? 'text-white/80 hover:text-[#39FF14]' : 'text-gray-700 hover:text-gray-900'} transition-colors`}
                  >
                    <ChevronRight size={18} className="rotate-180" />
                    Previous: Price Feeds
                  </a>
                </div>
              </div>
            </section>

          </div>
        </main>
      </div>
    </div>
  );
}
