import React, { useState } from 'react';
import { X, Check, Globe, Plus, Trash2, ExternalLink } from 'lucide-react';
import type { MangaItemDto, ReadingStatus, UpdateMangaInput, ToastType } from '../types';
import { api } from '../api/client';
import { cleanDomainName } from '../utils/formatters';
import { sanitizeExternalUrl } from '../utils/urlSecurity';

interface EditMangaModalProps {
  readonly isOpen: boolean;
  readonly manga: MangaItemDto | null;
  readonly onClose: () => void;
  readonly onUpdated: (manga: MangaItemDto) => void;
  readonly onShowToast: (title: string, message?: string, type?: ToastType) => void;
}

export const EditMangaModal: React.FC<EditMangaModalProps> = ({
  isOpen,
  manga,
  onClose,
  onUpdated,
  onShowToast,
}) => {
  if (!isOpen || !manga) return null;

  const [title, setTitle] = useState(manga.title);
  const [coverUrl, setCoverUrl] = useState(manga.coverUrl || '');
  const [status, setStatus] = useState<ReadingStatus>(manga.status);
  const [lastReadChapter, setLastReadChapter] = useState(manga.lastReadChapter?.toString() || '');
  const [notes, setNotes] = useState(manga.notes || '');

  // Add Backup Source Form
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceLabel, setNewSourceLabel] = useState('');
  const [isAddingSource, setIsAddingSource] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      onShowToast('ชื่อเรื่องต้องไม่ว่างเปล่า', undefined, 'error');
      return;
    }

    const parsedLastRead = lastReadChapter.trim() === '' ? null : Number(lastReadChapter);

    const input: UpdateMangaInput = {
      title: title.trim(),
      coverUrl: coverUrl.trim() || null,
      status,
      lastReadChapter: isNaN(parsedLastRead as number) ? null : parsedLastRead,
      notes: notes.trim() || null,
    };

    setIsSubmitting(true);
    try {
      const updated = await api.updateManga(manga.id, input);
      onUpdated(updated);
      onShowToast('บันทึกการแก้ไขแล้ว', title.trim(), 'success');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก';
      onShowToast('แก้ไขไม่สำเร็จ', msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSource = async () => {
    if (!newSourceUrl.trim()) return;
    setIsAddingSource(true);
    try {
      const added = await api.addSource(manga.id, {
        label: newSourceLabel.trim() || `เว็บ (${cleanDomainName(newSourceUrl)})`,
        url: newSourceUrl.trim(),
        domain: cleanDomainName(newSourceUrl),
        isPrimary: false,
        extractionMode: { kind: 'auto' },
        fetchStrategy: 'http',
      });
      const updatedManga: MangaItemDto = {
        ...manga,
        sources: [...manga.sources, added],
      };
      onUpdated(updatedManga);
      setNewSourceUrl('');
      setNewSourceLabel('');
      setShowAddSource(false);
      onShowToast('เพิ่มเว็บสำรองเรียบร้อย', added.label, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถเพิ่มเว็บได้';
      onShowToast('เกิดข้อผิดพลาด', msg, 'error');
    } finally {
      setIsAddingSource(false);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    try {
      await api.deleteSource(manga.id, sourceId);
      const updatedManga: MangaItemDto = {
        ...manga,
        sources: manga.sources.filter((s) => s.id !== sourceId),
      };
      onUpdated(updatedManga);
      onShowToast('ลบเว็บเรียบร้อย', undefined, 'info');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถลบเว็บได้';
      onShowToast('เกิดข้อผิดพลาด', msg, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/40">
          <div>
            <h2 className="text-base font-bold text-slate-100">แก้ไขข้อมูลเรื่อง & แหล่งเว็บ</h2>
            <p className="text-xs text-slate-400 truncate max-w-md">{manga.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">ชื่อเรื่อง</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">สถานะ</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ReadingStatus)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100"
              >
                <option value="READING">กำลังอ่าน (Reading)</option>
                <option value="ON_HOLD">ดองไว้ (On Hold)</option>
                <option value="PLAN_TO_READ">วางแผนจะอ่าน (Plan to Read)</option>
                <option value="COMPLETED">อ่านจบแล้ว (Completed)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">อ่านถึงตอนที่</label>
              <input
                type="number"
                step="any"
                value={lastReadChapter}
                onChange={(e) => setLastReadChapter(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">URL รูปปก</label>
            <input
              type="text"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">บันทึกย่อ (Notes)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100"
            />
          </div>

          {/* Sources List Management */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">เว็บที่ติดตามทั้งหมด</span>
              <button
                type="button"
                onClick={() => setShowAddSource(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มเว็บสำรอง</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {manga.sources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="font-semibold text-slate-200">
                      {source.label || source.domain}
                    </span>
                    {source.isPrimary && (
                      <span className="px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-400 text-[10px] border border-indigo-800/60">
                        เว็บหลัก
                      </span>
                    )}
                    <a
                      href={sanitizeExternalUrl(source.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  {!source.isPrimary && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSource(source.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      title="ลบเว็บนี้"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {showAddSource && (
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-700/80 space-y-2 animate-in fade-in">
                <input
                  type="text"
                  value={newSourceLabel}
                  onChange={(e) => setNewSourceLabel(e.target.value)}
                  placeholder="ป้ายชื่อเว็บ (เช่น เว็บแปลไทยสำรอง)"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100"
                />
                <input
                  type="text"
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  placeholder="URL เว็บ https://..."
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddSource(false)}
                    className="px-2.5 py-1 text-xs text-slate-400"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleAddSource}
                    disabled={isAddingSource || !newSourceUrl.trim()}
                    className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium"
                  >
                    เพิ่ม
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>บันทึกการแก้ไข</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
