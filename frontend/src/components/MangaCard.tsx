import React, { useState } from 'react';
import {
  ExternalLink,
  BookOpen,
  Plus,
  RefreshCw,
  Sparkles,
  Globe,
  MoreVertical,
  Edit2,
  Trash2,
  AlertCircle,
  Check,
} from 'lucide-react';
import type { MangaItemDto } from '../types';
import { formatChapterLabel, formatRelativeTime, cleanDomainName, getStatusBadgeInfo } from '../utils/formatters';
import { isSafeHttpUrl } from '../utils/urlSecurity';

interface MangaCardProps {
  readonly manga: MangaItemDto;
  readonly onMarkRead: (id: string, chapterNumber: number, title?: string, url?: string) => Promise<void>;
  readonly onCheckNow: (id: string) => Promise<void>;
  readonly onSimulateUpdate: (id: string) => Promise<void>;
  readonly onEdit: (manga: MangaItemDto) => void;
  readonly onDelete: (id: string) => Promise<void>;
}

export const MangaCard: React.FC<MangaCardProps> = ({
  manga,
  onMarkRead,
  onCheckNow,
  onSimulateUpdate,
  onEdit,
  onDelete,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const statusInfo = getStatusBadgeInfo(manga.status);
  const primarySource = manga.sources.find((s) => s.isPrimary) || manga.sources[0];
  const backupSources = manga.sources.filter((s) => s.id !== primarySource?.id);
  const primaryDomain = primarySource ? cleanDomainName(primarySource.domain || primarySource.url) : 'เว็บไม่ระบุ';

  // Read URL for 1-click reading
  const targetReadUrl = manga.latestChapterUrl || primarySource?.url || '#';
  const targetChapterNumber = manga.latestChapter ?? ((manga.lastReadChapter ?? 0) + 1);

  const handleQuickPlusOne = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextChapter = (manga.lastReadChapter ?? 0) + 1;
    setIsMarking(true);
    try {
      await onMarkRead(manga.id, nextChapter);
    } finally {
      setIsMarking(false);
    }
  };

  const handleReadAndMark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Open chapter in new tab
    if (isSafeHttpUrl(targetReadUrl)) {
      window.open(targetReadUrl, '_blank', 'noopener,noreferrer');
    }
    // Automatically record chapter reading progress
    if (targetChapterNumber !== null) {
      setIsMarking(true);
      try {
        await onMarkRead(
          manga.id,
          targetChapterNumber,
          manga.latestChapterTitle || undefined,
          targetReadUrl
        );
      } finally {
        setIsMarking(false);
      }
    }
  };

  const handleSingleCheck = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsChecking(true);
    try {
      await onCheckNow(manga.id);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSimulate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSimulating(true);
    try {
      await onSimulateUpdate(manga.id);
    } finally {
      setIsSimulating(false);
    }
  };

  // Check error state in primary source
  const hasSourceError = primarySource?.checkState.kind === 'error';
  const sourceErrorMessage = primarySource?.checkState.kind === 'error' ? primarySource.checkState.error : null;

  return (
    <div
      className={`group relative flex flex-col bg-slate-900/90 rounded-2xl border transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 ${
        manga.hasUnread
          ? 'border-emerald-500/60 shadow-lg shadow-emerald-500/10 hover:border-emerald-400'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Top Banner for Unread Update */}
      {manga.hasUnread && (
        <div className="absolute -top-3 left-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/30 animate-pulse-glow">
          <Sparkles className="w-3.5 h-3.5 fill-current" />
          <span>มีตอนใหม่! {manga.unreadCountEstimate > 0 ? `(+${manga.unreadCountEstimate} ตอน)` : ''}</span>
        </div>
      )}

      {/* Card Header & Cover Section */}
      <div className="p-4 sm:p-5 flex gap-4">
        {/* Manga Cover Thumbnail */}
        <div className="relative shrink-0 w-24 h-32 sm:w-28 sm:h-36 rounded-xl overflow-hidden bg-slate-800 border border-slate-700/60 shadow-inner">
          {manga.coverUrl ? (
            <img
              src={manga.coverUrl}
              alt={manga.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              onError={(e) => {
                // Graceful fallback on broken image
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950">
              <BookOpen className="w-8 h-8 text-indigo-400/60 mb-1" />
              <span className="text-[10px] text-slate-400 font-medium line-clamp-2">
                {manga.title}
              </span>
            </div>
          )}

          {/* Reading Status Badge on cover bottom */}
          <div className="absolute bottom-0 inset-x-0 p-1 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent">
            <span
              className={`block text-center text-[10px] font-medium py-0.5 px-1.5 rounded-md border ${statusInfo.bgClass} ${statusInfo.textClass} ${statusInfo.borderClass}`}
            >
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* Info Column */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            {/* Title & Options Menu */}
            <div className="flex items-start justify-between gap-2">
              <h3
                className="text-base font-bold text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-2 leading-snug"
                title={manga.title}
              >
                {manga.title}
              </h3>

              {/* Action Dropdown Menu */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  aria-label="Options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {showMenu && (
                  <div
                    className="absolute right-0 top-8 z-20 w-44 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95"
                    onClick={() => setShowMenu(false)}
                  >
                    <button
                      type="button"
                      onClick={() => onEdit(manga)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:bg-indigo-600/20 hover:text-indigo-300 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>แก้ไข / จัดการเว็บ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(true)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ลบเรื่องนี้</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Domains Badges (Pain point 1: อ่านหลายเว็บ จำไม่ได้ว่าอยู่เว็บไหน) */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800/90 text-cyan-300 border border-cyan-800/40"
                title={`เว็บหลัก: ${primarySource?.url || ''}`}
              >
                <Globe className="w-3 h-3 text-cyan-400" />
                <span>{primaryDomain}</span>
              </span>

              {backupSources.map((backup) => (
                <span
                  key={backup.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-normal bg-slate-800/60 text-slate-300 border border-slate-700/60"
                  title={`เว็บสำรอง: ${backup.label} (${backup.url})`}
                >
                  <span>+{cleanDomainName(backup.domain || backup.url)}</span>
                </span>
              ))}
            </div>

            {/* Scrape Error Warning if any */}
            {hasSourceError && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/40 border border-amber-800/50 rounded-lg px-2 py-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate" title={sourceErrorMessage || 'เช็คตอนใหม่ไม่สำเร็จ'}>
                  {sourceErrorMessage || 'เช็คตอนใหม่ไม่สำเร็จ'}
                </span>
              </div>
            )}
          </div>

          {/* Reading Progress vs Latest Comparison (Pain point 2) */}
          <div className="mt-3 grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            {/* Left: อ่านถึงตอนไหน */}
            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-slate-400">อ่านถึง:</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm font-bold text-slate-100">
                  {formatChapterLabel(manga.lastReadChapter, 'ยังไม่ได้เริ่ม')}
                </span>
                <button
                  type="button"
                  onClick={handleQuickPlusOne}
                  disabled={isMarking}
                  className="p-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors"
                  title="บันทึก +1 ตอนทันที"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Right: ตอนล่าสุดบนเว็บ */}
            <div className="flex flex-col border-l border-slate-800/80 pl-2.5">
              <span className="text-[11px] font-medium text-slate-400">ล่าสุดบนเว็บ:</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className={`text-sm font-bold truncate ${
                    manga.hasUnread ? 'text-emerald-400' : 'text-slate-300'
                  }`}
                  title={manga.latestChapterTitle || undefined}
                >
                  {formatChapterLabel(manga.latestChapter, 'รอตรวจสอบ')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Quick Actions */}
      <div className="mt-auto p-3 sm:px-4 sm:py-3 border-t border-slate-800/80 bg-slate-950/40 rounded-b-2xl flex items-center justify-between gap-2">
        {/* Left: 1-Click "ไปอ่านตอนใหม่ & บันทึก" button */}
        <button
          type="button"
          onClick={handleReadAndMark}
          disabled={isMarking}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-200 shadow-sm ${
            manga.hasUnread
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
          }`}
          title="เปิดเว็บอ่านตอนใหม่พร้อมบันทึกตอนที่อ่านอัตโนมัติ"
        >
          {isMarking ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ExternalLink className="w-3.5 h-3.5" />
          )}
          <span>
            {manga.hasUnread
              ? `ไปอ่านตอนใหม่ (${formatChapterLabel(manga.latestChapter)}) & บันทึก`
              : 'ไปอ่านต่อ & บันทึก'}
          </span>
        </button>

        {/* Right: Check Now and Simulate Alert Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Check Single Manga Button */}
          <button
            type="button"
            onClick={handleSingleCheck}
            disabled={isChecking}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-700 transition-colors border border-slate-700/50"
            title="เช็คตอนใหม่เรื่องนี้ตอนนี้"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          {/* Simulate New Chapter Alert Button (Pain point 4) */}
          <button
            type="button"
            onClick={handleSimulate}
            disabled={isSimulating}
            className="p-2 rounded-xl text-amber-400/90 hover:text-amber-300 bg-amber-950/30 hover:bg-amber-900/40 transition-colors border border-amber-800/40"
            title="จำลองมีตอนใหม่อัปเดต (ทดสอบระบบแจ้งเตือนแชทและเว็บ)"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Updated Time Label */}
      <div className="px-4 pb-2 text-[10px] text-slate-500 flex justify-between items-center">
        <span>อัปเดตล่าสุด: {formatRelativeTime(manga.latestUpdatedAt || manga.updatedAt)}</span>
        {manga.notes && (
          <span className="truncate max-w-[140px] text-slate-400 italic" title={manga.notes}>
            📝 {manga.notes}
          </span>
        )}
      </div>

      {/* Delete Confirmation Modal / Overlay */}
      {isConfirmingDelete && (
        <div className="absolute inset-0 z-30 bg-slate-950/95 backdrop-blur-sm rounded-2xl p-4 flex flex-col items-center justify-center text-center animate-in fade-in">
          <Trash2 className="w-8 h-8 text-rose-500 mb-2" />
          <h4 className="text-sm font-bold text-slate-100">ยืนยันการลบเรื่องนี้?</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-[200px] truncate">{manga.title}</p>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(false)}
              className="px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={async () => {
                await onDelete(manga.id);
                setIsConfirmingDelete(false);
              }}
              className="px-3 py-1.5 text-xs text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>ลบทันที</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
