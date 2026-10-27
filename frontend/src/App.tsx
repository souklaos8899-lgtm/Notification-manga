import React, { useState, useEffect, useCallback } from 'react';
import type {
  MangaItemDto,
  NotificationChannelDto,
  NotificationLogDto,
  SystemSettingsDto,
  UserProfileDto,
  FilterStatus,
  SortField,
  ToastMessage,
  ModalState,
  CreateMangaInput,
} from './types';
import { api } from './api/client';
import { showBrowserNotification } from './utils/browserNotifications';
import { Navbar } from './components/Navbar';
import { MangaList } from './components/MangaList';
import { AddMangaModal } from './components/AddMangaModal';
import { EditMangaModal } from './components/EditMangaModal';
import { NotificationChannelsModal } from './components/NotificationChannelsModal';
import { NotificationCenter } from './components/NotificationCenter';
import { SystemSettingsModal } from './components/SystemSettingsModal';
import { AuthModal } from './components/AuthModal';
import { ToastContainer } from './components/ToastContainer';
import { Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

const DEFAULT_SETTINGS: SystemSettingsDto = {
  appMode: 'personal',
  allowPublicRegistration: true,
  checkIntervalMinutes: 15,
  lastGlobalCheckAt: new Date().toISOString(),
};

export const App: React.FC = () => {
  // Global Domain State
  const [mangaList, setMangaList] = useState<readonly MangaItemDto[]>([]);
  const [channels, setChannels] = useState<readonly NotificationChannelDto[]>([]);
  const [notifications, setNotifications] = useState<readonly NotificationLogDto[]>([]);
  const [settings, setSettings] = useState<SystemSettingsDto>(DEFAULT_SETTINGS);
  const [currentUser, setCurrentUser] = useState<UserProfileDto | null>(null);

  // UI / Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [filterDomain, setFilterDomain] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('LATEST_UPDATE');

  // Modals (Discriminated Union pattern)
  const [modalState, setModalState] = useState<ModalState>({ kind: 'none' });
  const [editingManga, setEditingManga] = useState<MangaItemDto | null>(null);

  // Loading & Async Flags
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isCheckingAll, setIsCheckingAll] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<readonly ToastMessage[]>([]);

  const showToast = useCallback(
    (title: string, message?: string, type: ToastMessage['type'] = 'info') => {
      const newToast: ToastMessage = {
        id: Math.random().toString(36).substring(2, 9),
        title,
        message,
        type,
      };
      setToasts((prev) => [...prev, newToast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 5000);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch initial data
  const loadAllData = useCallback(async () => {
    try {
      setConnectionError(null);

      // Load Settings & Auth concurrently
      const [settingsData, meData] = await Promise.allSettled([
        api.getSettings(),
        api.getMe(),
      ]);

      if (settingsData.status === 'fulfilled') {
        setSettings(settingsData.value);
      }
      if (meData.status === 'fulfilled') {
        setCurrentUser(meData.value);
      }

      // Load Manga, Channels, Notifications
      const [mangaRes, channelsRes, notifsRes] = await Promise.allSettled([
        api.getMangaList(),
        api.getChannels(),
        api.getNotifications(),
      ]);

      if (mangaRes.status === 'fulfilled') {
        setMangaList(mangaRes.value);
      }
      if (channelsRes.status === 'fulfilled') {
        setChannels(channelsRes.value);
      }
      if (notifsRes.status === 'fulfilled') {
        setNotifications(notifsRes.value);
      }
    } catch (err) {
      console.error('Failed to load application data:', err);
      setConnectionError('ไม่สามารถเชื่อมต่อ Backend API ได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์เปิดอยู่หรือไม่');
    } finally {
      setIsLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Manga Operations
  const handleCreateManga = async (input: CreateMangaInput) => {
    const created = await api.createManga(input);
    setMangaList((prev) => [created, ...prev]);
  };

  const handleUpdateManga = (updated: MangaItemDto) => {
    setMangaList((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    if (editingManga?.id === updated.id) {
      setEditingManga(updated);
    }
  };

  const handleDeleteManga = async (id: string) => {
    await api.deleteManga(id);
    setMangaList((prev) => prev.filter((m) => m.id !== id));
    showToast('ลบมังงะเรียบร้อยแล้ว', undefined, 'info');
  };

  const handleMarkRead = async (
    id: string,
    chapterNumber: number,
    title?: string,
    url?: string
  ) => {
    try {
      const updated = await api.markRead(id, chapterNumber, title, url);
      setMangaList((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      showToast('บันทึกตอนที่อ่านแล้ว', `${updated.title}: ตอนที่ ${chapterNumber}`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก';
      showToast('บันทึกตอนที่อ่านไม่สำเร็จ', msg, 'error');
    }
  };

  const handleCheckNow = async (id: string) => {
    try {
      const updated = await api.checkManga(id);
      setMangaList((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));

      if (updated.hasUnread) {
        showToast(
          'พบตอนใหม่!',
          `${updated.title} มีตอนล่าสุด: ตอนที่ ${updated.latestChapter}`,
          'success'
        );
        showBrowserNotification(`มีตอนใหม่: ${updated.title}`, {
          body: `ตอนล่าสุด: ตอนที่ ${updated.latestChapter}`,
          icon: updated.coverUrl || undefined,
          url: updated.latestChapterUrl || undefined,
        });
        // Reload notifications
        const notifs = await api.getNotifications();
        setNotifications(notifs);
      } else {
        showToast('ยังไม่มีตอนใหม่', `${updated.title} อัปเดตล่าสุดแล้ว`, 'info');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเช็คตอน';
      showToast('เช็คตอนใหม่ไม่สำเร็จ', msg, 'error');
    }
  };

  const handleSimulateUpdate = async (id: string) => {
    try {
      const updated = await api.simulateUpdate(id);
      setMangaList((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));

      showToast(
        'จำลองตอนใหม่สำเร็จ! (แจ้งเตือนส่งเข้าแชทแล้ว)',
        `${updated.title} อัปเดตเป็นตอนที่ ${updated.latestChapter}`,
        'success'
      );

      // Trigger desktop browser notification
      showBrowserNotification(`[จำลองตอนใหม่] ${updated.title}`, {
        body: `อัปเดตเป็นตอนที่ ${updated.latestChapter} แจ้งเตือนเข้า Telegram/Discord แล้ว`,
        icon: updated.coverUrl || undefined,
        url: updated.latestChapterUrl || undefined,
      });

      // Reload notifications
      const notifs = await api.getNotifications();
      setNotifications(notifs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการจำลอง';
      showToast('จำลองตอนใหม่ไม่สำเร็จ', msg, 'error');
    }
  };

  const handleCheckAll = async () => {
    setIsCheckingAll(true);
    try {
      const res = await api.checkAllManga();
      showToast('เช็คทุกเรื่องสำเร็จ!', res.message || `ตรวจเช็คแล้ว ${res.checkedCount} เรื่อง`, 'success');
      // Reload manga list and notifications
      const [mangaRes, notifsRes] = await Promise.all([
        api.getMangaList(),
        api.getNotifications(),
      ]);
      setMangaList(mangaRes);
      setNotifications(notifsRes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      showToast('เช็คทุกเรื่องไม่สำเร็จ', msg, 'error');
    } finally {
      setIsCheckingAll(false);
    }
  };

  // Notification Center Handlers
  const handleMarkNotificationRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      showToast('ทำเครื่องหมายอ่านทั้งหมดแล้ว', undefined, 'info');
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    showToast('ออกจากระบบแล้ว', undefined, 'info');
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;
  const activeChannelsCount = channels.filter((c) => c.enabled).length;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        unreadNotificationsCount={unreadNotificationsCount}
        activeChannelsCount={activeChannelsCount}
        isCheckingAll={isCheckingAll}
        onCheckAll={handleCheckAll}
        onOpenAddModal={() => setModalState({ kind: 'add_manga' })}
        onOpenChannelsModal={() => setModalState({ kind: 'notification_channels' })}
        onOpenNotificationsCenter={() => setModalState({ kind: 'notifications_center' })}
        onOpenSettingsModal={() => setModalState({ kind: 'system_settings' })}
        currentUser={currentUser}
        onOpenAuthModal={() => setModalState({ kind: 'auth' })}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Hero Banner / Problem-solving Header */}
        <div className="relative rounded-3xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-950 p-6 sm:p-8 border border-slate-800 shadow-xl overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold border border-indigo-500/20 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>ติดตามหลายเว็บ ไม่พลาดทุกตอน ไม่ลืมที่อ่านค้างไว้</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              รวมมังงะทุกเว็บไซต์ไว้ในที่เดียว พร้อมแจ้งเตือนส่งเข้า Chat
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              เพียงแค่วาง URL หน้าอ่าน ระบบจะตรวจจับตอนล่าสุดให้อัตโนมัติ เมื่อมีตอนใหม่จะส่งข้อความเข้า{' '}
              <span className="text-sky-400 font-medium">Telegram</span>,{' '}
              <span className="text-indigo-400 font-medium">Discord</span> หรือ{' '}
              <span className="text-emerald-400 font-medium">LINE</span> ทันที
            </p>
          </div>
        </div>

        {/* Backend Connection Warning if offline */}
        {connectionError && (
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-between gap-3 text-amber-300 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{connectionError}</span>
            </div>
            <button
              type="button"
              onClick={loadAllData}
              className="px-3 py-1 rounded-lg bg-amber-900/60 hover:bg-amber-800 text-white font-medium flex items-center gap-1 shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              <span>ลองใหม่</span>
            </button>
          </div>
        )}

        {/* Manga Cards & Filter List */}
        {isLoadingInitial ? (
          <div className="py-24 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400">กำลังโหลดข้อมูลมังงะและระบบแจ้งเตือน...</p>
          </div>
        ) : (
          <MangaList
            mangaList={mangaList}
            filterStatus={filterStatus}
            onFilterStatusChange={setFilterStatus}
            filterDomain={filterDomain}
            onFilterDomainChange={setFilterDomain}
            sortField={sortField}
            onSortFieldChange={setSortField}
            searchQuery={searchQuery}
            onMarkRead={handleMarkRead}
            onCheckNow={handleCheckNow}
            onSimulateUpdate={handleSimulateUpdate}
            onEdit={(m) => {
              setEditingManga(m);
              setModalState({ kind: 'edit_manga', mangaId: m.id });
            }}
            onDelete={handleDeleteManga}
            onOpenAddModal={() => setModalState({ kind: 'add_manga' })}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/50 py-6 text-center text-xs text-slate-500">
        <p>MangaPing &copy; {new Date().getFullYear()} — Smart Manga Tracker & Notification System</p>
      </footer>

      {/* Modals */}
      <AddMangaModal
        isOpen={modalState.kind === 'add_manga'}
        onClose={() => setModalState({ kind: 'none' })}
        onCreated={handleCreateManga}
        onShowToast={showToast}
      />

      <EditMangaModal
        isOpen={modalState.kind === 'edit_manga'}
        manga={editingManga}
        onClose={() => {
          setModalState({ kind: 'none' });
          setEditingManga(null);
        }}
        onUpdated={handleUpdateManga}
        onShowToast={showToast}
      />

      <NotificationChannelsModal
        isOpen={modalState.kind === 'notification_channels'}
        channels={channels}
        onClose={() => setModalState({ kind: 'none' })}
        onChannelCreated={(ch) => setChannels((prev) => [...prev, ch])}
        onChannelUpdated={(ch) =>
          setChannels((prev) => prev.map((item) => (item.id === ch.id ? ch : item)))
        }
        onChannelDeleted={(id) => setChannels((prev) => prev.filter((item) => item.id !== id))}
        onShowToast={showToast}
      />

      <NotificationCenter
        isOpen={modalState.kind === 'notifications_center'}
        notifications={notifications}
        onClose={() => setModalState({ kind: 'none' })}
        onMarkAsRead={handleMarkNotificationRead}
        onMarkAllAsRead={handleMarkAllNotificationsRead}
        onShowToast={showToast}
      />

      <SystemSettingsModal
        isOpen={modalState.kind === 'system_settings'}
        settings={settings}
        onClose={() => setModalState({ kind: 'none' })}
        onSettingsUpdated={setSettings}
        onShowToast={showToast}
      />

      <AuthModal
        isOpen={modalState.kind === 'auth'}
        settings={settings}
        onClose={() => setModalState({ kind: 'none' })}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          loadAllData();
        }}
        onShowToast={showToast}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
