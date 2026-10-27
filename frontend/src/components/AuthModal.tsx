import React, { useState } from 'react';
import { X, Lock, User, Key, Sparkles, LogIn, UserPlus } from 'lucide-react';
import type { SystemSettingsDto, UserProfileDto, ToastType } from '../types';
import { api } from '../api/client';

interface AuthModalProps {
  readonly isOpen: boolean;
  readonly settings: SystemSettingsDto;
  readonly onClose: () => void;
  readonly onAuthSuccess: (user: UserProfileDto) => void;
  readonly onShowToast: (title: string, message?: string, type?: ToastType) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  settings,
  onClose,
  onAuthSuccess,
  onShowToast,
}) => {
  if (!isOpen) return null;

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleQuickPersonalLogin = async () => {
    setIsLoading(true);
    try {
      const user = await api.quickPersonalLogin();
      onAuthSuccess(user);
      onShowToast('เข้าสู่ระบบโหมดส่วนตัวสำเร็จ!', `ยินดีต้อนรับ ${user.displayName}`, 'success');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถเข้าสู่ระบบด่วนได้';
      onShowToast('เข้าสู่ระบบไม่สำเร็จ', msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      onShowToast('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน', undefined, 'error');
      return;
    }

    setIsLoading(true);
    try {
      if (tab === 'login') {
        const user = await api.login(username.trim(), password);
        onAuthSuccess(user);
        onShowToast('เข้าสู่ระบบสำเร็จ!', `ยินดีต้อนรับ ${user.displayName}`, 'success');
      } else {
        if (!displayName.trim()) {
          onShowToast('กรุณากรอกชื่อที่แสดง (Display Name)', undefined, 'error');
          setIsLoading(false);
          return;
        }
        const user = await api.register(username.trim(), password, displayName.trim());
        onAuthSuccess(user);
        onShowToast('สร้างบัญชีสำเร็จ!', `ยินดีต้อนรับ ${user.displayName}`, 'success');
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      onShowToast(tab === 'login' ? 'เข้าสู่ระบบไม่สำเร็จ' : 'สมัครสมาชิกไม่สำเร็จ', msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {tab === 'login' ? 'เข้าสู่ระบบติดตามมังงะ' : 'สร้างบัญชีผู้ใช้ใหม่'}
              </h2>
              <p className="text-xs text-slate-400">
                {settings.appMode === 'personal'
                  ? 'ระบบอยู่ในโหมดใช้งานส่วนตัว'
                  : 'ระบบรองรับผู้ใช้หลายคน'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Personal Mode Quick Access Button (Pain point 6) */}
          {settings.appMode === 'personal' && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/80 to-purple-950/80 border border-indigo-500/40 space-y-2.5 shadow-lg">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-indigo-200">เข้าใช้งานส่วนตัวแบบ 1-Click</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                ระบบตั้งค่าไว้สำหรับเจ้าของ ไม่จำเป็นต้องพิมพ์รหัสผ่าน กดปุ่มด้านล่างเพื่อเริ่มใช้งานได้ทันที
              </p>
              <button
                type="button"
                onClick={handleQuickPersonalLogin}
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>เข้าใช้งานโหมดส่วนตัว (1-Click Personal Access)</span>
              </button>
            </div>
          )}

          {/* Tab Switcher if registration is allowed */}
          {settings.allowPublicRegistration && (
            <div className="flex border-b border-slate-800 pb-2 gap-4">
              <button
                type="button"
                onClick={() => setTab('login')}
                className={`text-xs font-bold pb-2 border-b-2 transition-colors ${
                  tab === 'login'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                เข้าสู่ระบบ (Login)
              </button>
              <button
                type="button"
                onClick={() => setTab('register')}
                className={`text-xs font-bold pb-2 border-b-2 transition-colors ${
                  tab === 'register'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                สมัครสมาชิก (Register)
              </button>
            </div>
          )}

          {/* Standard Login / Register Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                ชื่อผู้ใช้งาน (Username)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin หรือ username"
                  className="w-full pl-10 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100"
                  required
                />
              </div>
            </div>

            {tab === 'register' && (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  ชื่อที่แสดง (Display Name)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="เช่น พี่หนวดมังงะ"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100"
                  required
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
            >
              {tab === 'login' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>เข้าสู่ระบบ</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>สมัครสมาชิก</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
