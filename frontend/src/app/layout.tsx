import type { Metadata } from 'next';
import { Kanit } from 'next/font/google';
import '../index.css';

const kanit = Kanit({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-kanit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MangaAlert - ระบบแจ้งเตือนมังงะตอนใหม่อัตโนมัติ',
  description: 'ระบบติดตามมังงะและแจ้งเตือนตอนใหม่อัตโนมัติ ตรวจสอบตอนใหม่เรียลไทม์ และส่งการแจ้งเตือนผ่าน Discord, Line, Telegram และ Webhook',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`dark ${kanit.variable}`}>
      <body className="bg-slate-950 text-slate-100 min-h-screen selection:bg-indigo-500 selection:text-white font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
