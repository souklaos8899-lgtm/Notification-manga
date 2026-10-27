import React, { useState } from 'react';
import {
  X,
  Settings,
  UserCheck,
  Clock,
  RefreshCw,
  CheckCircle2,
  Lock,
  Globe2,
} from 'lucide-react';
import type { SystemSettingsDto, ToastType } from '../types';
import { api } from '../api/client';
import { formatRelativeTime } from '../utils/formatters';

interface SystemSettingsModalProps {
  readonly isOpen: boolean;
  readonly settings: SystemSettingsDto;
  readonly onClose: () => void;
  readonly onSettingsUpdated: (settings: SystemSettingsDto) => void;
  readonly onShowToast: (title: string, message?: string, type?: ToastType) => void;
}

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onSettingsUpdated,
  onShowToast,
}) => {
  if (!isOpen) return null;

  const [appMode, setAppMode] = useState<'personal' | 'public'>(settings.appMode);
  const [allowPublicRegistration, setAllowPublicRegistration] = useState(settings.allowPublicRegistration);
  const [checkIntervalMinutes, setCheckIntervalMinutes] = useState(settings.checkIntervalMinutes);

  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingAll, setIsCheckingAll] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await api.updateSettings({
        appMode,
        allowPublicRegistration,
        checkIntervalMinutes: Number(checkIntervalMinutes),
      });
      onSettingsUpdated(updated);
      onShowToast('บันทึกการตั้งค่าระบบเรียบร้อย', undefined, 'success');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก';
      onShowToast('บันทึกไม่สำเร็จ', msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckAllNow = async () => {
    setIsCheckingAll(true);
    try {
      const res = await api.checkAllManga();
      onShowToast('เช็คทุกเรื่องสำเร็จ!', res.message || `ตรวจสอบแล้ว ${res.checkedCount} เรื่อง`, 'success');
      // refresh settings to get updated lastGlobalCheckAt
      const refreshed = await api.getSettings();
      onSettingsUpdated(refreshed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถเช็คทุกเรื่องได้';
      onShowToast('เกิดข้อผิดพลาด', msg, 'error');
    } finally {
      setIsCheckingAll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">การตั้งค่าระบบ (System Settings)</h2>
              <p className="text-xs text-slate-400">
                จัดการโหมดใช้งาน ความถี่การเช็คตอนใหม่ และการรับสมาชิก
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

        {/* Settings Body */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-5">
          {/* App Mode: Personal vs Public */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              โหมดการใช้งานของระบบ (App Mode):
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAppMode('personal')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  appMode === 'personal'
                    ? 'bg-indigo-950/60 border-indigo-500 shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Lock className={`w-4 h-4 ${appMode === 'personal' ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <span className={`text-xs font-bold ${appMode === 'personal' ? 'text-indigo-200' : 'text-slate-300'}`}>
                    โหมดใช้ส่วนตัว (Personal)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  สำหรับเจ้าของคนเดียว เข้าใช้งานได้ด้วยปุ่ม 1-Click ไม่ต้องคอยพิมพ์รหัสผ่าน
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAppMode('public')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  appMode === 'public'
                    ? 'bg-indigo-950/60 border-indigo-500 shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Globe2 className={`w-4 h-4 ${appMode === 'public' ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <span className={`text-xs font-bold ${appMode === 'public' ? 'text-indigo-200' : 'text-slate-300'}`}>
                    โหมดสาธารณะ (Public)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  รองรับผู้ใช้หลายคน แต่ละคนติดตามมังงะและตั้งค่าแชทของตัวเองแยกกัน
                </p>
              </button>
            </div>
          </div>

          {/* Allow Public Registration */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <UserCheck className="w-5 h-5 text-indigo-400 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-slate-200 block">
                  เปิดรับสมัครสมาชิกใหม่ (Public Registration)
                </span>
                <span className="text-[11px] text-slate-400">
                  อนุญาตให้บุคคลภายนอกสร้างบัญชีใหม่เพื่อติดตามมังงะได้
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={allowPublicRegistration}
                onChange={(e) => setAllowPublicRegistration(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Check Interval */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>ความถี่เช็คตอนใหม่อัตโนมัติ (Background Cron):</span>
            </label>
            <select
              value={checkIntervalMinutes}
              onChange={(e) => setCheckIntervalMinutes(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100"
            >
              <option value={15}>ทุก 15 นาที (เร็วสุด แนะนำ)</option>
              <option value={30}>ทุก 30 นาที</option>
              <option value={60}>ทุก 1 ชั่วโมง</option>
              <option value={120}>ทุก 2 ชั่วโมง</option>
              <option value={360}>ทุก 6 ชั่วโมง</option>
            </select>
          </div>

          {/* Check All Now Card */}
          <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/40 flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-indigo-200 block">
                สั่งตรวจเช็คทุกเรื่องเดี๋ยวนี้
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                เช็คครั้งล่าสุด:{' '}
                <strong className="text-slate-300">
                  {formatRelativeTime(settings.lastGlobalCheckAt)}
                </strong>
              </span>
            </div>

            <button
              type="button"
              onClick={handleCheckAllNow}
              disabled={isCheckingAll}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingAll ? 'animate-spin' : ''}`} />
              <span>{isCheckingAll ? 'กำลังเช็ค...' : 'เช็คทุกเรื่องทันที'}</span>
            </button>
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>บันทึกการตั้งค่า</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
