"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ChevronRight,
  ChevronLeft,
  X,
  Zap,
  Home,
  PieChart,
  Plus,
  History,
  TrendingUp,
  Lock,
  MessageCircle,
  Settings,
  Wallet,
  Target,
  Receipt
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
    { icon: Target, label: "Resolve", href: "/resolve", active: pathname === "/resolve" },
    { icon: Receipt, label: "Betslip", href: "/betslip", active: pathname === "/betslip" },
    { icon: Plus, label: "Create Market", href: "/create-market", active: pathname === "/create-market" },
    { icon: Plus, label: "Add Token", href: "/add-token", active: pathname === "/add-token" },
    { icon: History, label: "History", href: "/history", active: pathname === "/history" },
    { icon: TrendingUp, label: "Analytics", href: "/analytics", active: pathname === "/analytics" },
    { icon: MessageCircle, label: "Community", href: "/community", active: pathname === "/community" },
    { icon: Settings, label: "Settings", href: "/settings", active: pathname === "/settings" }
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
          ? 'bg-gray-900 border-gray-800' 
          : 'bg-white border-gray-200'
        } border-r
      `}>
        
        {/* Collapse Button - Desktop Only */}
        <button
          onClick={onToggleCollapse}
          className={`
            hidden lg:flex absolute -right-3 top-6 w-6 h-6 rounded-full items-center justify-center transition-colors
            ${isDarkMode
              ? 'bg-gray-800 border-gray-700 hover:bg-gray-700'
              : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
            } border
          `}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className={`p-4 border-b ${
            isDarkMode ? 'border-gray-800' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              {collapsed ? (
                <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <Zap size={18} className="text-white" />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                    <Zap size={18} className="text-white" />
                  </div>
                  <span className={`font-bold text-xl ${
                    isDarkMode ? 'text-emerald-500' : 'text-emerald-600'
                  }`}>Peer2Pepu</span>
                </div>
              )}
              
              {/* Mobile Close Button */}
              <button 
                onClick={onClose}
                className={`lg:hidden p-1 rounded transition-colors ${
                  isDarkMode 
                    ? 'hover:bg-gray-800' 
                    : 'hover:bg-gray-100'
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
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${item.active
                    ? 'bg-emerald-600 text-white'
                    : isDarkMode
                      ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
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
              isDarkMode ? 'border-gray-800' : 'border-gray-200'
            }`}>
              <div className={`p-3 rounded-lg ${
                isDarkMode ? 'bg-gray-800' : 'bg-gray-50'
              }`}>
                {isConnected ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-emerald-500">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      Connected
                    </div>
                    <div className="flex items-center gap-2">
                      <Wallet size={16} className="text-emerald-500" />
                      <button
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 ${
                          isDarkMode 
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
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
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      Not Connected
                    </div>
                    <div className="flex items-center gap-2">
                      <Wallet size={16} className="text-emerald-500" />
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
              isDarkMode ? 'border-gray-800' : 'border-gray-200'
            }`}>
              <div className="flex justify-center">
                {isConnected ? (
                  <button
                    className={`w-8 h-8 rounded-lg transition-colors flex items-center justify-center ${
                      isDarkMode 
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                    onClick={() => setShowDisconnectModal(true)}
                    title={`${address?.slice(0, 6)}...${address?.slice(-4)}`}
                  >
                    <Wallet size={16} className="text-emerald-500" />
                  </button>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Wallet size={16} className="text-gray-400" />
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
            isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${
              isDarkMode ? 'text-gray-200' : 'text-gray-800'
            }`}>
              Disconnect Wallet
            </h3>
            <p className={`text-sm mb-6 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Are you sure you want to disconnect your wallet?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDisconnectModal(false)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
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
