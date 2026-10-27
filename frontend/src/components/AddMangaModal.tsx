import React, { useState } from 'react';
import {
  X,
  Search,
  Sparkles,
  Layers,
  Code2,
  Check,
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  CreateMangaInput,
  ExtractionMode,
  ReadingStatus,
  UrlAnalyzeResultDto,
  DetectedChapterCandidate,
  ToastType,
} from '../types';
import { api } from '../api/client';
import { cleanDomainName, formatChapterLabel } from '../utils/formatters';

interface AddMangaModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onCreated: (input: CreateMangaInput) => Promise<void>;
  readonly onShowToast: (title: string, message?: string, type?: ToastType) => void;
}

interface BackupSourceEntry {
  readonly id: string;
  readonly label: string;
  readonly url: string;
}

export const AddMangaModal: React.FC<AddMangaModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  onShowToast,
}) => {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<UrlAnalyzeResultDto | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [status, setStatus] = useState<ReadingStatus>('READING');
  const [lastReadChapter, setLastReadChapter] = useState<string>('0');
  const [notes, setNotes] = useState('');

  // Chapter Candidate / Selector Mode
  const [selectedCandidate, setSelectedCandidate] = useState<DetectedChapterCandidate | null>(null);
  const [useCustomSelector, setUseCustomSelector] = useState(false);
  const [customChapterSelector, setCustomChapterSelector] = useState('');
  const [customTitleSelector, setCustomTitleSelector] = useState('');
  const [customCoverSelector, setCustomCoverSelector] = useState('');

  // Backup Sources
  const [backupSources, setBackupSources] = useState<readonly BackupSourceEntry[]>([]);
  const [newBackupUrl, setNewBackupUrl] = useState('');
  const [newBackupLabel, setNewBackupLabel] = useState('');
  const [showAddBackup, setShowAddBackup] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFillDemo = () => {
    setUrl('demo://manga/solo-leveling-ragnarok?chapter=45');
  };

  const handleAnalyze = async () => {
    if (!url.trim()) {
      onShowToast('กรุณากรอก URL หน้าเว็บมังงะ', undefined, 'error');
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await api.analyzeUrl(url.trim());
      setAnalysisResult(result);
      if (result.detectedTitle) {
        setTitle(result.detectedTitle);
      }
      if (result.detectedCoverUrl) {
        setCoverUrl(result.detectedCoverUrl);
      }
      if (result.recommendedChapter) {
        setSelectedCandidate(result.recommendedChapter);
        if (result.recommendedChapter.chapterNumber !== null) {
          // Default lastReadChapter to recommendedChapter - 1, or 0
          const initialRead = Math.max(0, result.recommendedChapter.chapterNumber - 1);
          setLastReadChapter(initialRead.toString());
        }
      }
      onShowToast('วิเคราะห์หน้าเว็บสำเร็จ!', `พบมังงะ: ${result.detectedTitle}`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถวิเคราะห์ URL ได้';
      onShowToast('การวิเคราะห์ผิดพลาด', msg, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddBackup = () => {
    if (!newBackupUrl.trim()) return;
    const entry: BackupSourceEntry = {
      id: Math.random().toString(36).substring(2, 9),
      label: newBackupLabel.trim() || `เว็บสำรอง (${cleanDomainName(newBackupUrl)})`,
      url: newBackupUrl.trim(),
    };
    setBackupSources([...backupSources, entry]);
    setNewBackupUrl('');
    setNewBackupLabel('');
    setShowAddBackup(false);
  };

  const handleRemoveBackup = (id: string) => {
    setBackupSources(backupSources.filter((s) => s.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) {
      onShowToast('กรุณากรอกชื่อเรื่องและ URL เว็บหลัก', undefined, 'error');
      return;
    }

    // Determine extraction mode
    let primaryExtractionMode: ExtractionMode = { kind: 'auto' };
    if (useCustomSelector && customChapterSelector.trim()) {
      primaryExtractionMode = {
        kind: 'css',
        chapterSelector: customChapterSelector.trim(),
        titleSelector: customTitleSelector.trim() || undefined,
        coverSelector: customCoverSelector.trim() || undefined,
      };
    } else if (selectedCandidate && selectedCandidate.selectorHint) {
      primaryExtractionMode = {
        kind: 'css',
        chapterSelector: selectedCandidate.selectorHint,
      };
    }

    const primarySource = {
      url: url.trim(),
      label: `เว็บหลัก (${cleanDomainName(url)})`,
      extractionMode: primaryExtractionMode,
      fetchStrategy: 'http' as const,
      isPrimary: true,
    };

    const backups = backupSources.map((b) => ({
      url: b.url,
      label: b.label,
      extractionMode: { kind: 'auto' } as ExtractionMode,
      fetchStrategy: 'http' as const,
      isPrimary: false,
    }));

    const parsedLastRead = lastReadChapter.trim() === '' ? null : Number(lastReadChapter);

    const input: CreateMangaInput = {
      title: title.trim(),
      coverUrl: coverUrl.trim() || null,
      status,
      lastReadChapter: isNaN(parsedLastRead as number) ? null : parsedLastRead,
      notes: notes.trim() || null,
      sources: [primarySource, ...backups],
    };

    setIsSubmitting(true);
    try {
      await onCreated(input);
      onShowToast('เพิ่มมังงะเรียบร้อยแล้ว!', title.trim(), 'success');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก';
      onShowToast('บันทึกไม่สำเร็จ', msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">เพิ่มเรื่องใหม่จาก URL หน้าเว็บ</h2>
              <p className="text-xs text-slate-400">
                ใส่ลิงก์หน้าอ่าน ระบบจะวิเคราะห์ชื่อเรื่อง ตอนล่าสุด และรูปปกให้อัตโนมัติ
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Step 1: URL Input & Smart Analyzer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span>URL หน้าหลักของมังงะ</span>
                <span className="text-rose-400">*</span>
              </label>

              {/* Demo URL Button */}
              <button
                type="button"
                onClick={handleFillDemo}
                className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                <span>ลองใส่ URL ตัวอย่าง (Demo URL)</span>
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://nekopost.net/manga/... หรือ https://manga-site.com/..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm text-slate-100 placeholder:text-slate-500 transition-colors"
                required
              />
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isAnalyzing || !url.trim()}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 shrink-0"
              >
                {isAnalyzing ? (
                  <>
                    <Search className="w-4 h-4 animate-spin" />
                    <span>กำลังวิเคราะห์...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>วิเคราะห์หน้าเว็บ</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Analysis Result Banner */}
          {analysisResult && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 space-y-3 animate-in fade-in">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {analysisResult.detectedCoverUrl && (
                    <img
                      src={analysisResult.detectedCoverUrl}
                      alt="Cover Preview"
                      className="w-14 h-20 object-cover rounded-lg border border-slate-700 shrink-0 shadow-md"
                    />
                  )}
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-950/60 border border-indigo-700/50 px-2 py-0.5 rounded-md inline-block mb-1">
                      Platform: {analysisResult.detectedPlatform}
                    </span>
                    <h4 className="text-sm font-bold text-slate-100 line-clamp-1">
                      {analysisResult.detectedTitle || 'ไม่สามารถดึงชื่อเรื่องได้'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      โดเมน: <span className="text-cyan-400">{analysisResult.domain}</span>
                    </p>
                  </div>
                </div>

                {analysisResult.recommendedChapter && (
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block">ตอนล่าสุดที่ตรวจพบ:</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {formatChapterLabel(analysisResult.recommendedChapter.chapterNumber)}
                    </span>
                  </div>
                )}
              </div>

              {/* Interactive Candidate Picker (Pain point 3) */}
              {analysisResult.candidates.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span>เลือก Element ตอนล่าสุดจาก Candidates ที่ตรวจพบ:</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setUseCustomSelector(!useCustomSelector)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 font-medium"
                    >
                      <Code2 className="w-3 h-3" />
                      <span>{useCustomSelector ? 'กลับไปใช้ Candidate' : 'โหมดระบุ CSS Selector เอง'}</span>
                    </button>
                  </div>

                  {!useCustomSelector ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                      {analysisResult.candidates.map((cand, idx) => {
                        const isSelected = selectedCandidate?.selectorHint === cand.selectorHint;
                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedCandidate(cand)}
                            className={`p-2.5 rounded-lg border cursor-pointer text-left transition-all ${
                              isSelected
                                ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200 shadow-sm'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold">
                                {formatChapterLabel(cand.chapterNumber, cand.chapterTitle || 'ตอน')}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  cand.confidence === 'high'
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                ความแม่นยำ: {cand.confidence === 'high' ? 'สูง' : 'ปานกลาง'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono block truncate mt-1">
                              {cand.selectorHint}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Custom CSS Selector Input Mode */
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2 animate-in fade-in">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">
                          CSS Selector สำหรับดึงเลขตอน (Chapter Selector):
                        </label>
                        <input
                          type="text"
                          value={customChapterSelector}
                          onChange={(e) => setCustomChapterSelector(e.target.value)}
                          placeholder="เช่น .wp-manga-chapter a, .chapter-list li a:first-child"
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-indigo-300 placeholder:text-slate-600"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">
                            Title Selector (ไม่บังคับ):
                          </label>
                          <input
                            type="text"
                            value={customTitleSelector}
                            onChange={(e) => setCustomTitleSelector(e.target.value)}
                            placeholder="h1.entry-title"
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 placeholder:text-slate-600"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">
                            Cover Selector (ไม่บังคับ):
                          </label>
                          <input
                            type="text"
                            value={customCoverSelector}
                            onChange={(e) => setCustomCoverSelector(e.target.value)}
                            placeholder=".summary_image img"
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 placeholder:text-slate-600"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Manga Details Form Fields */}
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                ชื่อเรื่อง <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น Solo Leveling: Ragnarok"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 text-sm text-slate-100 placeholder:text-slate-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  สถานะการอ่าน
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ReadingStatus)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 text-sm text-slate-100"
                >
                  <option value="READING">กำลังอ่าน (Reading)</option>
                  <option value="ON_HOLD">ดองไว้ (On Hold)</option>
                  <option value="PLAN_TO_READ">วางแผนจะอ่าน (Plan to Read)</option>
                  <option value="COMPLETED">อ่านจบแล้ว (Completed)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  อ่านค้างไว้ถึงตอนที่:
                </label>
                <input
                  type="number"
                  step="any"
                  value={lastReadChapter}
                  onChange={(e) => setLastReadChapter(e.target.value)}
                  placeholder="เช่น 104 หรือ 0"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 text-sm text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                URL รูปภาพปก (ถ้ามี):
              </label>
              <input
                type="text"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 text-sm text-slate-100 placeholder:text-slate-500"
              />
            </div>

            {/* Backup Sources Section (Pain point 1: เว็บสำรอง) */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-200">
                    ลิงก์เว็บสำรอง (Backup URLs)
                  </span>
                  <p className="text-[11px] text-slate-400">
                    ใส่เว็บอ่านสำรอง เช่น เว็บแปลไทย + เว็บต้นฉบับ Eng
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddBackup(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่มเว็บสำรอง</span>
                </button>
              </div>

              {backupSources.length > 0 && (
                <div className="space-y-1.5">
                  {backupSources.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-medium text-cyan-300">{s.label}:</span>
                        <span className="text-slate-400 truncate">{s.url}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBackup(s.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors ml-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showAddBackup && (
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-700/80 space-y-2 animate-in fade-in">
                  <input
                    type="text"
                    value={newBackupLabel}
                    onChange={(e) => setNewBackupLabel(e.target.value)}
                    placeholder="ป้ายชื่อเว็บ (เช่น เว็บแปลไทยสำรอง, Mangadex)"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100"
                  />
                  <input
                    type="text"
                    value={newBackupUrl}
                    onChange={(e) => setNewBackupUrl(e.target.value)}
                    placeholder="URL เว็บสำรอง https://..."
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddBackup(false)}
                      className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={handleAddBackup}
                      disabled={!newBackupUrl.trim()}
                      className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium"
                    >
                      เพิ่ม
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                บันทึกย่อส่วนตัว (Notes):
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="เช่น รอแปลไทย, สนุกมากช่วงศึกใหญ่..."
                rows={2}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 text-sm text-slate-100 placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Footer Submit Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !url.trim()}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/30 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>บันทึกและเริ่มติดตาม</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
