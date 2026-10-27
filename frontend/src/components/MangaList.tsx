import React, { useMemo } from 'react';
import {
  Sparkles,
  BookOpen,
  ArrowUpDown,
  Globe,
  Plus,
} from 'lucide-react';
import type { MangaItemDto, FilterStatus, SortField } from '../types';
import { MangaCard } from './MangaCard';
import { cleanDomainName } from '../utils/formatters';

interface MangaListProps {
  readonly mangaList: readonly MangaItemDto[];
  readonly filterStatus: FilterStatus;
  readonly onFilterStatusChange: (status: FilterStatus) => void;
  readonly filterDomain: string;
  readonly onFilterDomainChange: (domain: string) => void;
  readonly sortField: SortField;
  readonly onSortFieldChange: (field: SortField) => void;
  readonly searchQuery: string;
  readonly onMarkRead: (id: string, chapterNumber: number, title?: string, url?: string) => Promise<void>;
  readonly onCheckNow: (id: string) => Promise<void>;
  readonly onSimulateUpdate: (id: string) => Promise<void>;
  readonly onEdit: (manga: MangaItemDto) => void;
  readonly onDelete: (id: string) => Promise<void>;
  readonly onOpenAddModal: () => void;
}

export const MangaList: React.FC<MangaListProps> = ({
  mangaList,
  filterStatus,
  onFilterStatusChange,
  filterDomain,
  onFilterDomainChange,
  sortField,
  onSortFieldChange,
  searchQuery,
  onMarkRead,
  onCheckNow,
  onSimulateUpdate,
  onEdit,
  onDelete,
  onOpenAddModal,
}) => {
  // Extract all unique domains across all manga sources
  const allDomains = useMemo(() => {
    const domainSet = new Set<string>();
    mangaList.forEach((m) => {
      m.sources.forEach((s) => {
        const cleaned = cleanDomainName(s.domain || s.url);
        if (cleaned) domainSet.add(cleaned);
      });
    });
    return Array.from(domainSet).sort();
  }, [mangaList]);

  // Counts for status tabs
  const counts = useMemo(() => {
    return {
      all: mangaList.length,
      unread: mangaList.filter((m) => m.hasUnread).length,
      reading: mangaList.filter((m) => m.status === 'READING').length,
      onHold: mangaList.filter((m) => m.status === 'ON_HOLD').length,
      planToRead: mangaList.filter((m) => m.status === 'PLAN_TO_READ').length,
      completed: mangaList.filter((m) => m.status === 'COMPLETED').length,
    };
  }, [mangaList]);

  // Filter & Search logic
  const filteredList = useMemo(() => {
    let result = [...mangaList];

    // Status filter
    if (filterStatus === 'UNREAD') {
      result = result.filter((m) => m.hasUnread);
    } else if (filterStatus !== 'ALL') {
      result = result.filter((m) => m.status === filterStatus);
    }

    // Domain filter
    if (filterDomain !== 'ALL') {
      result = result.filter((m) =>
        m.sources.some((s) => cleanDomainName(s.domain || s.url) === filterDomain)
      );
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((m) => {
        const titleMatch = m.title.toLowerCase().includes(q);
        const domainMatch = m.sources.some((s) =>
          (s.domain || s.url).toLowerCase().includes(q)
        );
        return titleMatch || domainMatch;
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortField === 'LATEST_UPDATE') {
        const timeA = new Date(a.latestUpdatedAt || a.updatedAt).getTime();
        const timeB = new Date(b.latestUpdatedAt || b.updatedAt).getTime();
        return timeB - timeA;
      }
      if (sortField === 'LAST_READ') {
        const timeA = a.lastReadAt ? new Date(a.lastReadAt).getTime() : 0;
        const timeB = b.lastReadAt ? new Date(b.lastReadAt).getTime() : 0;
        return timeB - timeA;
      }
      if (sortField === 'TITLE') {
        return a.title.localeCompare(b.title, 'th');
      }
      return 0;
    });

    return result;
  }, [mangaList, filterStatus, filterDomain, searchQuery, sortField]);

  return (
    <div className="space-y-6">
      {/* Filter and Control Bar */}
      <div className="flex flex-col gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => onFilterStatusChange('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filterStatus === 'ALL'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>ทั้งหมด</span>
            <span className="px-1.5 py-0.2 rounded-md bg-slate-950/40 text-[10px]">
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onFilterStatusChange('UNREAD')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filterStatus === 'UNREAD'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400/50'
                : 'bg-slate-900 text-emerald-400 hover:bg-emerald-950/30 border border-emerald-900/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>มีตอนใหม่ยังไม่อ่าน!</span>
            {counts.unread > 0 && (
              <span className="px-1.5 py-0.2 rounded-md bg-emerald-500 text-slate-950 text-[10px] font-bold">
                {counts.unread}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onFilterStatusChange('READING')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filterStatus === 'READING'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>กำลังอ่าน</span>
            <span className="px-1.5 py-0.2 rounded-md bg-slate-950/40 text-[10px]">
              {counts.reading}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onFilterStatusChange('ON_HOLD')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filterStatus === 'ON_HOLD'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>ดองไว้</span>
            <span className="px-1.5 py-0.2 rounded-md bg-slate-950/40 text-[10px]">
              {counts.onHold}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onFilterStatusChange('PLAN_TO_READ')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filterStatus === 'PLAN_TO_READ'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>วางแผนจะอ่าน</span>
            <span className="px-1.5 py-0.2 rounded-md bg-slate-950/40 text-[10px]">
              {counts.planToRead}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onFilterStatusChange('COMPLETED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filterStatus === 'COMPLETED'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>อ่านจบแล้ว</span>
            <span className="px-1.5 py-0.2 rounded-md bg-slate-950/40 text-[10px]">
              {counts.completed}
            </span>
          </button>
        </div>

        {/* Secondary Filter & Sort Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-800/80">
          {/* Domain Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-slate-400 hidden sm:inline">กรองตามเว็บ:</span>
            <select
              value={filterDomain}
              onChange={(e) => onFilterDomainChange(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">ทุกเว็บไซต์ ({allDomains.length} เว็บ)</option>
              {allDomains.map((dom) => (
                <option key={dom} value={dom}>
                  {dom}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Field Dropdown */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-indigo-400" />
            <span className="text-xs text-slate-400 hidden sm:inline">เรียงตาม:</span>
            <select
              value={sortField}
              onChange={(e) => onSortFieldChange(e.target.value as SortField)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="LATEST_UPDATE">ตอนใหม่อัปเดตล่าสุด</option>
              <option value="LAST_READ">อ่านค้างไว้ล่าสุด</option>
              <option value="TITLE">ชื่อเรื่อง (ก-ฮ)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Manga Grid */}
      {filteredList.length === 0 ? (
        <div className="py-20 px-4 text-center rounded-3xl border border-dashed border-slate-800 bg-slate-950/40">
          <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-200">ไม่พบมังงะในเงื่อนไขนี้</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `ไม่มีผลการค้นหาสำหรับ "${searchQuery}" ลองเปลี่ยนคำค้นหา`
              : 'ยังไม่มีมังงะในหมวดนี้ เริ่มต้นเพิ่มมังงะเรื่องโปรดเพื่อเริ่มรับการแจ้งเตือน'}
          </p>
          <button
            type="button"
            onClick={onOpenAddModal}
            className="mt-5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>+ เพิ่มเรื่องใหม่จาก URL</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredList.map((manga) => (
            <MangaCard
              key={manga.id}
              manga={manga}
              onMarkRead={onMarkRead}
              onCheckNow={onCheckNow}
              onSimulateUpdate={onSimulateUpdate}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};
