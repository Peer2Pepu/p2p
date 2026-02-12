"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ChevronRight,
  ChevronLeft,
  X,
  Home,
  PieChart,
  Plus,
  TrendingUp,
  Lock,
  Wallet,
  Receipt,
  Shield,
  User,
  FileText
} from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance, useChainId, useDisconnect } from 'wagmi';
import { pepuMainnet } from '../chains';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isDarkMode: boolean;
}

export function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse, isDarkMode }: SidebarProps) {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  
  const sidebarItems = [
    { icon: Home, label: "Markets", href: "/", active: pathname === "/" },
    { icon: Shield, label: "Assert", href: "/assert", active: pathname === "/assert" },
    { icon: Receipt, label: "Stakes", href: "/stakes", active: pathname === "/stakes" },
    { icon: Plus, label: "Create Market", href: "/create-market", active: pathname === "/create-market" },
    { icon: User, label: "Profile", href: "/profile", active: pathname === "/profile" },
    { icon: TrendingUp, label: "Analytics", href: "/analytics", active: pathname === "/analytics" },
    { icon: FileText, label: "Docs", href: "/docs", active: pathname === "/docs" },
    { icon: Shield, label: "Admin", href: "/admin", active: pathname === "/admin" }
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed left-0 top-0 h-full z-50 transition-all duration-300
        ${collapsed ? 'w-16' : 'w-64'}
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isDarkMode 
          ? 'bg-black border-[#39FF14]/20' 
          : 'bg-[#F5F3F0] border-gray-200'
        } border-r
      `}>
        
        {/* Collapse Button - Desktop Only */}
        <button
          onClick={onToggleCollapse}
          className={`
            hidden lg:flex absolute -right-3 top-6 w-6 h-6 rounded-full items-center justify-center transition-colors
            ${isDarkMode
              ? 'bg-black border-[#39FF14]/30 hover:bg-[#39FF14]/10 text-[#39FF14]'
              : 'bg-[#F5F3F0] border-2 border-gray-800 hover:bg-gray-50 text-gray-900 shadow-md'
            } border
          `}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className={`p-4 border-b bg-black ${
            isDarkMode ? 'border-[#39FF14]/20' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <Link 
                href="/" 
                className={`flex items-center ${collapsed ? 'justify-center w-full' : 'w-full'} transition-opacity hover:opacity-80 cursor-pointer`}
              >
                <Image
                  src={collapsed ? "/lOGOgreen.svg" : "/logo.png"}
                  alt="Peer2Pepu Logo"
                  width={collapsed ? 48 : 180}
                  height={collapsed ? 48 : 60}
                  className="object-contain"
                  priority
                />
              </Link>
              
              {/* Mobile Close Button */}
              <button 
                onClick={onClose}
                className={`lg:hidden p-1 rounded transition-colors ${
                  isDarkMode 
                    ? 'hover:bg-[#39FF14]/10 text-white' 
                    : 'hover:bg-gray-100 text-gray-900'
                }`}
              >
                <X size={20} />
              </button>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-hide">
            {sidebarItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${item.active
                    ? `bg-[#39FF14] text-black ${isDarkMode ? '' : 'border border-black'}`
                    : isDarkMode
                      ? 'text-white hover:bg-[#39FF14]/10 hover:text-white'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={18} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            ))}
          </nav>
          
          {/* Wallet Status */}
          {!collapsed && (
            <div className={`p-4 border-t ${
              isDarkMode ? 'border-[#39FF14]/20' : 'border-gray-200'
            }`}>
              <div className={`p-3 rounded-lg ${
                isDarkMode ? 'bg-black border border-[#39FF14]/20' : 'bg-gray-50'
              }`}>
                {isConnected ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-[#39FF14]">
                      <div className="w-2 h-2 bg-[#39FF14] rounded-full"></div>
                      Connected
                    </div>
                    <div className="flex items-center gap-2">
                      <Wallet size={16} className="text-[#39FF14]" />
                      <button
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 ${
                          isDarkMode 
                            ? 'bg-[#39FF14]/10 hover:bg-[#39FF14]/20 text-white border border-[#39FF14]/30' 
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                        onClick={() => setShowDisconnectModal(true)}
                      >
                        <span>{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className={`flex items-center gap-2 text-xs ${
                      isDarkMode ? 'text-white/60' : 'text-gray-500'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        isDarkMode ? 'bg-[#F5F3F0]/40' : 'bg-gray-400'
                      }`}></div>
                      Not Connected
                    </div>
                    <div className="flex items-center gap-2">
                      <Wallet size={16} className={isDarkMode ? 'text-white' : 'text-emerald-500'} />
                      <ConnectButton />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Collapsed Wallet Status */}
          {collapsed && (
            <div className={`p-4 border-t ${
              isDarkMode ? 'border-[#39FF14]/20' : 'border-gray-200'
            }`}>
              <div className="flex justify-center">
                {isConnected ? (
                  <button
                    className={`w-8 h-8 rounded-lg transition-colors flex items-center justify-center ${
                      isDarkMode 
                        ? 'bg-[#39FF14]/10 hover:bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30' 
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                    onClick={() => setShowDisconnectModal(true)}
                    title={`${address?.slice(0, 6)}...${address?.slice(-4)}`}
                  >
                    <Wallet size={16} className={isDarkMode ? 'text-[#39FF14]' : 'text-emerald-500'} />
                  </button>
                ) : (
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isDarkMode ? 'bg-black border border-[#39FF14]/20' : 'bg-gray-100'
                  }`}>
                    <Wallet size={16} className={isDarkMode ? 'text-[#39FF14]/40' : 'text-gray-400'} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Disconnect Modal */}
      {showDisconnectModal && (
        <div 
          className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDisconnectModal(false);
            }
          }}
        >
          <div className={`p-6 rounded-lg max-w-sm w-full shadow-2xl transform transition-all duration-200 ${
            isDarkMode ? 'bg-black border border-[#39FF14]/30' : 'bg-[#F5F3F0] border border-gray-200'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${
              isDarkMode ? 'text-white' : 'text-gray-800'
            }`}>
              Disconnect Wallet
            </h3>
            <p className={`text-sm mb-6 ${
              isDarkMode ? 'text-white/70' : 'text-gray-600'
            }`}>
              Are you sure you want to disconnect your wallet?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDisconnectModal(false)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDarkMode 
                    ? 'bg-[#39FF14]/10 hover:bg-[#39FF14]/20 text-white border border-[#39FF14]/30' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  disconnect();
                  setShowDisconnectModal(false);
                }}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
