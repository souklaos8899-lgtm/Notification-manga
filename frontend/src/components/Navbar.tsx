import React from 'react';
import {
  BookOpenCheck,
  Search,
  Bell,
  Settings,
  Send,
  RefreshCw,
  Plus,
  LogIn,
  LogOut,
} from 'lucide-react';
import type { UserProfileDto } from '../types';

interface NavbarProps {
  readonly searchQuery: string;
  readonly onSearchChange: (q: string) => void;
  readonly unreadNotificationsCount: number;
  readonly activeChannelsCount: number;
  readonly isCheckingAll: boolean;
  readonly onCheckAll: () => Promise<void>;
  readonly onOpenAddModal: () => void;
  readonly onOpenChannelsModal: () => void;
  readonly onOpenNotificationsCenter: () => void;
  readonly onOpenSettingsModal: () => void;
  readonly currentUser: UserProfileDto | null;
  readonly onOpenAuthModal: () => void;
  readonly onLogout: () => Promise<void>;
}

export const Navbar: React.FC<NavbarProps> = ({
  searchQuery,
  onSearchChange,
  unreadNotificationsCount,
  activeChannelsCount,
  isCheckingAll,
  onCheckAll,
  onOpenAddModal,
  onOpenChannelsModal,
  onOpenNotificationsCenter,
  onOpenSettingsModal,
  currentUser,
  onOpenAuthModal,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#090d16]/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 text-white">
            <BookOpenCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-extrabold tracking-tight text-white">
                Manga<span className="text-indigo-400">Ping</span>
              </h1>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-950 text-indigo-400 border border-indigo-700/50">
                TH
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              ติดตามมังงะทุกเว็บ แจ้งเตือนตอนใหม่เข้าแชท
            </p>
          </div>
        </div>

        {/* Global Search Bar (Filter by title or domain) */}
        <div className="flex-1 max-w-md mx-2 hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ค้นหาชื่อเรื่อง หรือชื่อเว็บ เช่น nekopost, reapertrans..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs text-slate-100 placeholder:text-slate-500 transition-colors"
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Add Manga CTA */}
          <button
            type="button"
            onClick={onOpenAddModal}
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">เพิ่มเรื่องใหม่</span>
          </button>

          {/* Check All Now */}
          <button
            type="button"
            onClick={onCheckAll}
            disabled={isCheckingAll}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700/60 shrink-0"
            title="เช็คตอนใหม่ทุกเรื่องตอนนี้"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingAll ? 'animate-spin text-indigo-400' : ''}`} />
            <span className="hidden lg:inline">{isCheckingAll ? 'กำลังเช็ค...' : 'เช็คทุกเรื่อง'}</span>
          </button>

          {/* Notification Channels Button */}
          <button
            type="button"
            onClick={onOpenChannelsModal}
            className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/50"
            title="ตั้งค่าบอทแจ้งเตือนแชท (Telegram, Discord, LINE)"
          >
            <Send className="w-4 h-4 text-sky-400" />
            {activeChannelsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sky-500 text-[9px] font-bold text-slate-950 flex items-center justify-center">
                {activeChannelsCount}
              </span>
            )}
          </button>

          {/* In-App Notification Center Bell */}
          <button
            type="button"
            onClick={onOpenNotificationsCenter}
            className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/50"
            title="เปิดประวัติการแจ้งเตือน"
          >
            <Bell className="w-4 h-4 text-amber-400" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-[9px] font-bold text-slate-950 flex items-center justify-center animate-pulse">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* System Settings Button (Admin) */}
          <button
            type="button"
            onClick={onOpenSettingsModal}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/50"
            title="การตั้งค่าระบบ"
          >
            <Settings className="w-4 h-4 text-slate-400" />
          </button>

          {/* User Profile / Auth Button */}
          {currentUser ? (
            <div className="flex items-center gap-1.5 pl-1 border-l border-slate-800 ml-1">
              <div
                className="hidden xl:flex flex-col text-right leading-tight cursor-default"
                title={`เข้าสู่ระบบในชื่อ: ${currentUser.username} (${currentUser.role})`}
              >
                <span className="text-xs font-semibold text-slate-200 truncate max-w-[100px]">
                  {currentUser.displayName || currentUser.username}
                </span>
                <span className="text-[10px] text-indigo-400 uppercase font-mono">
                  {currentUser.role}
                </span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-indigo-500/30 ml-1"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">เข้าสู่ระบบ</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Search Input */}
      <div className="px-4 pb-3 md:hidden">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ค้นหาชื่อเรื่อง หรือชื่อเว็บ..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500"
          />
        </div>
      </div>
    </header>
  );
};
