import React, { useState } from 'react';
import {
  X,
  Bell,
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  HelpCircle,
  MessageSquare,
  Webhook,
  Power,
  RotateCw,
} from 'lucide-react';
import type { NotificationChannelDto, NotificationChannelConfig, ToastType } from '../types';
import { api } from '../api/client';

interface NotificationChannelsModalProps {
  readonly isOpen: boolean;
  readonly channels: readonly NotificationChannelDto[];
  readonly onClose: () => void;
  readonly onChannelCreated: (channel: NotificationChannelDto) => void;
  readonly onChannelUpdated: (channel: NotificationChannelDto) => void;
  readonly onChannelDeleted: (id: string) => void;
  readonly onShowToast: (title: string, message?: string, type?: ToastType) => void;
}

type ProviderType = 'telegram' | 'discord' | 'line' | 'webhook';

export const NotificationChannelsModal: React.FC<NotificationChannelsModalProps> = ({
  isOpen,
  channels,
  onClose,
  onChannelCreated,
  onChannelUpdated,
  onChannelDeleted,
  onShowToast,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [provider, setProvider] = useState<ProviderType>('telegram');
  const [channelName, setChannelName] = useState('');

  // Telegram fields
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');

  // Discord fields
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');

  // LINE fields
  const [lineAccessToken, setLineAccessToken] = useState('');
  const [lineUserId, setLineUserId] = useState('');

  // Custom Webhook fields
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');

  // Help guides accordion toggle
  const [showGuide, setShowGuide] = useState(false);

  // Testing state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTestChannel = async (channelId: string) => {
    setTestingId(channelId);
    try {
      const res = await api.testChannel(channelId);
      if (res.success) {
        onShowToast('ส่งข้อความทดสอบสำเร็จ!', res.message, 'success');
      } else {
        onShowToast('ส่งทดสอบไม่สำเร็จ', res.message, 'error');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการส่งทดสอบ';
      onShowToast('ส่งทดสอบไม่สำเร็จ', msg, 'error');
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleChannel = async (channel: NotificationChannelDto) => {
    try {
      const updated = await api.updateChannel(channel.id, { enabled: !channel.enabled });
      onChannelUpdated(updated);
      onShowToast(
        updated.enabled ? 'เปิดการแจ้งเตือนแล้ว' : 'ปิดการแจ้งเตือนชั่วคราว',
        channel.name,
        'info'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถเปลี่ยนสถานะได้';
      onShowToast('เกิดข้อผิดพลาด', msg, 'error');
    }
  };

  const handleDeleteChannel = async (id: string) => {
    try {
      await api.deleteChannel(id);
      onChannelDeleted(id);
      onShowToast('ลบช่องทางแจ้งเตือนแล้ว', undefined, 'info');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถลบช่องทางได้';
      onShowToast('เกิดข้อผิดพลาด', msg, 'error');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim()) {
      onShowToast('กรุณาระบุชื่อช่องทาง', undefined, 'error');
      return;
    }

    let config: NotificationChannelConfig;

    if (provider === 'telegram') {
      if (!telegramToken.trim() || !telegramChatId.trim()) {
        onShowToast('กรุณากรอก Bot Token และ Chat ID ของ Telegram', undefined, 'error');
        return;
      }
      config = {
        kind: 'telegram',
        botToken: telegramToken.trim(),
        chatId: telegramChatId.trim(),
      };
    } else if (provider === 'discord') {
      if (!discordWebhookUrl.trim()) {
        onShowToast('กรุณากรอก Discord Webhook URL', undefined, 'error');
        return;
      }
      config = {
        kind: 'discord',
        webhookUrl: discordWebhookUrl.trim(),
      };
    } else if (provider === 'line') {
      if (!lineAccessToken.trim() || !lineUserId.trim()) {
        onShowToast('กรุณากรอก Channel Access Token และ User ID ของ LINE', undefined, 'error');
        return;
      }
      config = {
        kind: 'line',
        channelAccessToken: lineAccessToken.trim(),
        toUserId: lineUserId.trim(),
      };
    } else {
      if (!webhookUrl.trim()) {
        onShowToast('กรุณากรอก Webhook URL', undefined, 'error');
        return;
      }
      config = {
        kind: 'webhook',
        url: webhookUrl.trim(),
        secretHeader: webhookSecret.trim() || undefined,
      };
    }

    setIsSubmitting(true);
    try {
      const created = await api.createChannel({
        name: channelName.trim(),
        enabled: true,
        config,
      });
      onChannelCreated(created);
      onShowToast('เพิ่มช่องทางแจ้งเตือนสำเร็จ!', created.name, 'success');

      // Reset and switch back
      setChannelName('');
      setTelegramToken('');
      setTelegramChatId('');
      setDiscordWebhookUrl('');
      setLineAccessToken('');
      setLineUserId('');
      setWebhookUrl('');
      setWebhookSecret('');
      setActiveTab('list');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถสร้างช่องทางแจ้งเตือนได้';
      onShowToast('เกิดข้อผิดพลาด', msg, 'error');
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
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                ตั้งค่าช่องทางแจ้งเตือนเข้าแชท (Multi-Channel Notifications)
              </h2>
              <p className="text-xs text-slate-400">
                เมื่อมังงะมีตอนใหม่ ระบบจะส่งข้อความแจ้งเตือนเข้า Telegram, Discord, LINE หรือ Webhook ทันที
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

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 px-5 pt-3 bg-slate-950/20 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'list'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>ช่องทางทั้งหมด ({channels.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ เพิ่มช่องทางใหม่</span>
          </button>
        </div>

        {/* Tab 1: Channels List */}
        {activeTab === 'list' && (
          <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {channels.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-slate-800">
                <Bell className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-300">ยังไม่มีช่องทางแจ้งเตือน</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  เพิ่มบอท Telegram หรือ Discord Webhook เพื่อรับข้อความแจ้งเตือนทันทีที่มีตอนใหม่
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มช่องทางแรกของคุณ</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {channels.map((ch) => {
                  let providerBadge = 'bg-slate-800 text-slate-300';
                  let providerTitle = 'Webhook';

                  if (ch.config.kind === 'telegram') {
                    providerBadge = 'bg-sky-950/80 text-sky-400 border border-sky-800/60';
                    providerTitle = 'Telegram Bot';
                  } else if (ch.config.kind === 'discord') {
                    providerBadge = 'bg-indigo-950/80 text-indigo-400 border border-indigo-800/60';
                    providerTitle = 'Discord Webhook';
                  } else if (ch.config.kind === 'line') {
                    providerBadge = 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60';
                    providerTitle = 'LINE Notify / Messaging';
                  }

                  return (
                    <div
                      key={ch.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        ch.enabled
                          ? 'bg-slate-900 border-slate-800'
                          : 'bg-slate-950/60 border-slate-900 opacity-60'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${providerBadge}`}
                          >
                            {providerTitle}
                          </span>
                          <h4 className="text-sm font-bold text-slate-100">{ch.name}</h4>
                        </div>
                        <p className="text-xs text-slate-500 font-mono">
                          {ch.config.kind === 'telegram'
                            ? `Chat ID: ${ch.config.chatId}`
                            : ch.config.kind === 'discord'
                              ? `URL: ${ch.config.webhookUrl.substring(0, 35)}...`
                              : ch.config.kind === 'line'
                                ? `To User: ${ch.config.toUserId}`
                                : `URL: ${ch.config.url}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Test Alert Button */}
                        <button
                          type="button"
                          onClick={() => handleTestChannel(ch.id)}
                          disabled={testingId === ch.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 transition-all flex items-center gap-1.5"
                          title="ส่งข้อความแจ้งเตือนทดสอบเข้าช่องทางนี้"
                        >
                          <RotateCw
                            className={`w-3.5 h-3.5 ${testingId === ch.id ? 'animate-spin' : ''}`}
                          />
                          <span>ทดสอบแจ้งเตือน</span>
                        </button>

                        {/* Power Toggle Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleChannel(ch)}
                          className={`p-2 rounded-lg transition-colors border ${
                            ch.enabled
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60 hover:bg-emerald-900/50'
                              : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700'
                          }`}
                          title={ch.enabled ? 'เปิดใช้งานอยู่ (คลิกเพื่อปิด)' : 'ปิดอยู่ (คลิกเพื่อเปิด)'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteChannel(ch.id)}
                          className="p-2 rounded-lg text-slate-500 hover:text-rose-400 bg-slate-800/60 hover:bg-rose-950/40 border border-slate-700/40 transition-colors"
                          title="ลบช่องทางนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Create New Channel */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreateSubmit} className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Provider Picker */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                เลือกประเภทแอปที่ต้องการให้ส่งแจ้งเตือน:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setProvider('telegram')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                    provider === 'telegram'
                      ? 'bg-sky-950/60 border-sky-500 text-sky-300 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Send className="w-5 h-5 text-sky-400" />
                  <span className="text-xs font-bold">Telegram</span>
                  <span className="text-[10px] text-slate-500">แนะนำ / ใช้ง่ายสุด</span>
                </button>

                <button
                  type="button"
                  onClick={() => setProvider('discord')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                    provider === 'discord'
                      ? 'bg-indigo-950/60 border-indigo-500 text-indigo-300 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <MessageSquare className="w-5 h-5 text-indigo-400" />
                  <span className="text-xs font-bold">Discord</span>
                  <span className="text-[10px] text-slate-500">Webhook ห้อง</span>
                </button>

                <button
                  type="button"
                  onClick={() => setProvider('line')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                    provider === 'line'
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <MessageSquare className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs font-bold">LINE</span>
                  <span className="text-[10px] text-slate-500">Messaging API</span>
                </button>

                <button
                  type="button"
                  onClick={() => setProvider('webhook')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                    provider === 'webhook'
                      ? 'bg-purple-950/60 border-purple-500 text-purple-300 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Webhook className="w-5 h-5 text-purple-400" />
                  <span className="text-xs font-bold">Custom URL</span>
                  <span className="text-[10px] text-slate-500">REST Webhook</span>
                </button>
              </div>
            </div>

            {/* Step-by-step Setup Guide */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="w-full flex items-center justify-between text-xs font-semibold text-indigo-400 hover:text-indigo-300"
              >
                <div className="flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4" />
                  <span>
                    {provider === 'telegram'
                      ? 'วิธีสร้าง Telegram Bot & หา Chat ID (ทำตามได้ใน 1 นาที)'
                      : provider === 'discord'
                        ? 'วิธีสร้าง Discord Webhook ใน Discord Server'
                        : provider === 'line'
                          ? 'วิธีตั้งค่า LINE Messaging API'
                          : 'คู่มือการรับข้อมูล Custom Webhook'}
                  </span>
                </div>
                <span className="text-[11px] underline">
                  {showGuide ? 'ซ่อนคำแนะนำ' : 'ดูคำแนะนำ'}
                </span>
              </button>

              {showGuide && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-300 space-y-2 leading-relaxed animate-in fade-in">
                  {provider === 'telegram' && (
                    <ol className="list-decimal list-inside space-y-1 text-slate-300">
                      <li>
                        เปิดแอป Telegram แล้วค้นหาบัญชี{' '}
                        <code className="text-sky-300 font-mono">@BotFather</code>
                      </li>
                      <li>
                        ส่งข้อความ <code className="text-sky-300 font-mono">/newbot</code> แล้วตั้งชื่อบอท
                        BotFather จะให้ <strong>HTTP API Bot Token</strong> มา (นำมากรอกด้านล่าง)
                      </li>
                      <li>
                        กดเริ่มคุยกับบอทของคุณเอง (<code className="text-sky-300 font-mono">/start</code>)
                      </li>
                      <li>
                        ค้นหาบอท <code className="text-sky-300 font-mono">@userinfobot</code> หรือกดดูในบอทเพื่อรับ{' '}
                        <strong>Chat ID</strong> ของคุณ แล้วนำมากรอกด้านล่าง!
                      </li>
                    </ol>
                  )}

                  {provider === 'discord' && (
                    <ol className="list-decimal list-inside space-y-1 text-slate-300">
                      <li>ในห้อง Discord Server ของคุณ ให้คลิกรูปเฟืองข้างห้องแชท (Edit Channel)</li>
                      <li>เลือกเมนู <strong>Integrations</strong> -&gt; <strong>Webhooks</strong></li>
                      <li>คลิก <strong>New Webhook</strong> ตั้งชื่อบอท แล้วกด <strong>Copy Webhook URL</strong></li>
                      <li>นำลิงก์ Webhook มาวางในช่องด้านล่าง</li>
                    </ol>
                  )}

                  {provider === 'line' && (
                    <ol className="list-decimal list-inside space-y-1 text-slate-300">
                      <li>ไปที่ <strong>LINE Developers Console</strong> สร้าง Messaging API Channel</li>
                      <li>ออก Channel Access Token (Long-lived)</li>
                      <li>ใส่ Your User ID ที่แสดงในหน้า Basic Settings</li>
                    </ol>
                  )}

                  {provider === 'webhook' && (
                    <p className="text-slate-400">
                      ระบบจะส่ง POST Request เป็น JSON พร้อมข้อมูลชื่อเรื่อง ตอนใหม่ และลิงก์อ่านไปยัง URL ที่คุณระบุ
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Channel Name */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                ชื่อช่องทาง (ตั้งชื่อเองเพื่อให้จำง่าย) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="เช่น บอทส่วนตัว Telegram, ห้อง Discord มังงะอัปเดต"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100"
                required
              />
            </div>

            {/* Provider Specific Inputs */}
            {provider === 'telegram' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Telegram Bot Token <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={telegramToken}
                    onChange={(e) => setTelegramToken(e.target.value)}
                    placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-sky-300 placeholder:text-slate-600"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Chat ID ของคุณหรือกลุ่ม <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="เช่น 12345678 หรือ -1001234567890"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-sky-300 placeholder:text-slate-600"
                    required
                  />
                </div>
              </div>
            )}

            {provider === 'discord' && (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Discord Webhook URL <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={discordWebhookUrl}
                  onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-indigo-300 placeholder:text-slate-600"
                  required
                />
              </div>
            )}

            {provider === 'line' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Channel Access Token <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={lineAccessToken}
                    onChange={(e) => setLineAccessToken(e.target.value)}
                    placeholder="LINE Channel Access Token..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-emerald-300 placeholder:text-slate-600"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    To User ID <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={lineUserId}
                    onChange={(e) => setLineUserId(e.target.value)}
                    placeholder="U1234567890abcdef..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-emerald-300 placeholder:text-slate-600"
                    required
                  />
                </div>
              </div>
            )}

            {provider === 'webhook' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Webhook Destination URL <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://my-server.com/api/manga-alert"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-purple-300 placeholder:text-slate-600"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Secret Header Key (ไม่บังคับ):
                  </label>
                  <input
                    type="text"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    placeholder="X-Webhook-Secret-Token"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 font-mono text-xs text-slate-300 placeholder:text-slate-600"
                  />
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>บันทึกช่องทางแจ้งเตือน</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
