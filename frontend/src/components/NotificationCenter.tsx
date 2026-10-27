import React from 'react';
import {
  Bell,
  X,
  ExternalLink,
  CheckCheck,
  Send,
  MessageSquare,
  AlertTriangle,
  Volume2,
} from 'lucide-react';
import type { NotificationLogDto, ToastType } from '../types';
import { formatRelativeTime, formatChapterLabel } from '../utils/formatters';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
} from '../utils/browserNotifications';
import { sanitizeExternalUrl } from '../utils/urlSecurity';

interface NotificationCenterProps {
  readonly isOpen: boolean;
  readonly notifications: readonly NotificationLogDto[];
  readonly onClose: () => void;
  readonly onMarkAsRead: (id: string) => Promise<void>;
  readonly onMarkAllAsRead: () => Promise<void>;
  readonly onShowToast: (title: string, message?: string, type?: ToastType) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  notifications,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onShowToast,
}) => {
  if (!isOpen) return null;

  const permission = getNotificationPermission();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleEnableDesktopNotifications = async () => {
    const res = await requestNotificationPermission();
    if (res === 'granted') {
      onShowToast('เปิดการแจ้งเตือนบนหน้าจอสำเร็จ!', 'คุณจะได้รับแจ้งเตือนแม้ไม่ได้เปิดหน้านี้', 'success');
    } else {
      onShowToast('ไม่ได้รับอนุญาตการแจ้งเตือน', 'กรุณาอนุญาตในการตั้งค่าเบราว์เซอร์', 'warning');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">ประวัติการแจ้งเตือน</h2>
              <p className="text-xs text-slate-400">
                {unreadCount > 0 ? `มี ${unreadCount} รายการที่ยังไม่ได้เปิดดู` : 'ไม่มีรายการค้างอ่าน'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="p-2 text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="ทำเครื่องหมายว่าอ่านทั้งหมดแล้ว"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline">อ่านทั้งหมด</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Web Desktop Notification Permission Banner */}
        {isNotificationSupported() && permission !== 'granted' && (
          <div className="p-3.5 bg-indigo-950/50 border-b border-indigo-800/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Volume2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-slate-200 block">เปิดแจ้งเตือนบนคอมพิวเตอร์</span>
                <span className="text-slate-400 text-[11px]">รับเสียงแจ้งเตือนทันทีแม้พับหน้าต่าง</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleEnableDesktopNotifications}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shrink-0 transition-colors shadow-sm"
            >
              เปิดใช้งาน
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">ยังไม่มีประวัติการแจ้งเตือน</p>
              <p className="text-xs text-slate-600 mt-1">
                เมื่อมังงะมีตอนใหม่ ระบบจะบันทึกประวัติการส่งไว้ที่นี่
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              let channelIcon = <Send className="w-3.5 h-3.5 text-sky-400" />;
              if (n.channelKind === 'discord') {
                channelIcon = <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />;
              } else if (n.channelKind === 'line') {
                channelIcon = <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />;
              }

              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.isRead) {
                      onMarkAsRead(n.id);
                    }
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    n.isRead
                      ? 'bg-slate-900/60 border-slate-800/80 opacity-75'
                      : 'bg-slate-900 border-indigo-500/50 shadow-md shadow-indigo-500/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        มีตอนใหม่อัปเดต!
                      </span>
                      <h4 className="text-sm font-bold text-slate-100">{n.mangaTitle}</h4>
                      <p className="text-xs text-indigo-300 font-medium">
                        {formatChapterLabel(n.chapterNumber, n.chapterTitle)}
                      </p>
                    </div>

                    <span className="text-[10px] text-slate-500 shrink-0">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </div>

                  {/* Delivery Status and Link */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {channelIcon}
                      <span className="text-slate-400 text-[11px]">{n.channelName}:</span>
                      {n.deliveryStatus === 'sent' ? (
                        <span className="text-[11px] font-medium text-emerald-400">ส่งสำเร็จ</span>
                      ) : (
                        <span
                          className="text-[11px] font-medium text-rose-400 flex items-center gap-1"
                          title={n.errorMessage || undefined}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          <span>ส่งล้มเหลว</span>
                        </span>
                      )}
                    </div>

                    {n.chapterUrl && (
                      <a
                        href={sanitizeExternalUrl(n.chapterUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-400 hover:text-indigo-400 flex items-center gap-1 text-[11px] transition-colors"
                      >
                        <span>เปิดอ่าน</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
