# 📚 Manga Update Tracker & Multi-Channel Chat Notification

ระบบติดตามมังงะจากหลายเว็บไซต์ผ่าน **URL ของเว็บอ่านโดยตรง (ไม่ต้องพึ่ง API ภายนอก)** พร้อมระบบตรวจจับตอนใหม่อัตโนมัติ, ช่วยจำว่าแต่ละเรื่องอ่านค้างถึงตอนที่เท่าไหร่แล้ว และอยู่เว็บไหน, พร้อมแจ้งเตือนทันทีผ่าน **Telegram Bot, Discord Webhook, LINE Messaging API, Custom Webhook และ Web Push Notification**

ออกแบบให้เริ่มต้นใช้งานแบบ **ส่วนตัว (Personal Mode - คลิกเดียวเข้าใช้งาน)** ได้ทันที และสามารถสลับเป็น **โหมดสาธารณะ (Public Multi-User Mode)** ได้จากหน้าตั้งค่าระบบ

---

## ✨ ฟีเจอร์หลัก (Key Features)

1. **ดึงข้อมูลจาก URL เว็บอ่านมังงะโดยตรง (Smart URL Analyzer & Hybrid Scraper)**
   - รองรับโครงสร้างเว็บมังงะยอดนิยมอัตโนมัติ: **WordPress Madara**, **MangaStream / Themesia**, และ **Generic Chapter Parser** (จับคำว่า `ตอนที่ X`, `บทที่ X`, `Chapter X`, `Ch. X`, `EP. X`)
   - มีระบบ **Visual Candidate Picker & Custom CSS Selector** ให้เลือกจุดดึงเลขตอนเองได้สำหรับเว็บที่มีโครงสร้างเฉพาะตัว
   - รองรับการใส่ **ลิงก์เว็บสำรอง (Backup URLs)** ในเรื่องเดียวกัน (เช่น เว็บแปลไทย + เว็บแปล Eng)

2. **ช่วยจำเว็บที่อ่าน & บันทึกตอนที่อ่านค้างไว้ (Reading Progress & Multi-Web Memory)**
   - แสดงป้ายชื่อเว็บไซต์ (Domain Badge) ของแต่ละเรื่องชัดเจน พร้อมตัวกรองแยกตามเว็บไซต์และสถานะการอ่าน (`มีตอนใหม่ยังไม่ได้อ่าน!`, `กำลังอ่าน`, `ดองไว้`, `วางแผนจะอ่าน`, `อ่านจบแล้ว`)
   - เปรียบเทียบ **ตอนที่อ่านถึงล่าสุด** กับ **ตอนใหม่ล่าสุดบนเว็บ**
   - ปุ่ม **ไปอ่านตอนใหม่ & บันทึกอัตโนมัติ (1-Click Read & Auto-Record)** ทั้งบนหน้าเว็บและจากลิงก์ในแชท (`/api/read/:mangaId`)

3. **แจ้งเตือนเข้าแชทหลายช่องทาง (Multi-Channel Chat Notifications)**
   - **Telegram Bot**: ส่งรูปปก + ชื่อเรื่อง + ตอนใหม่ + ตอนที่อ่านค้างไว้ + ลิงก์คลิกอ่านทันที
   - **Discord Webhook**: ส่งการ์ด Rich Embed พร้อมรูปปกและลิงก์อ่าน
   - **LINE Messaging API**: ส่งข้อความ Push แจ้งเตือนเข้า LINE
   - **Custom Webhook & Web Browser Notification**: แจ้งเตือนบนเบราว์เซอร์และประวัติการแจ้งเตือนในแอป
   - มีปุ่ม **ส่งข้อความทดสอบ (Test Alert)** และ **จำลองมีตอนใหม่อัปเดต (Simulate Update)** เพื่อทดสอบระบบแจ้งเตือนได้ทันทีโดยไม่ต้องรอเว็บจริงอัปเดต

4. **ความปลอดภัยระดับ Production (Security-by-Design)**
   - **SSRF Protection**: ตรวจสอบทุก URL และ DNS Resolution ในระดับ Socket (บล็อก `localhost`, Private IPv4/IPv6, IPv4-mapped IPv6, Octal/Hex IP, Link-local `169.254.x.x` และตรวจทุก Redirect Hop)
   - **Open Redirect Guard**: ตรวจสอบโดเมนปลายทางของ `/api/read/:mangaId` ให้ตรงกับโดเมนของเรื่องนั้นๆ เท่านั้น
   - **Anti-IDOR & Secret Masking**: แยกข้อมูลผู้ใช้แต่ละบัญชีอย่างเข้มงวด รหัสผ่านเข้ารหัสด้วย `bcryptjs (cost 12)` และซ่อน Token ความลับด้วย `••••`

---

## 🗂️ โครงสร้างโปรเจกต์ (Project Structure)

```text
notification-manga/
├── shared/
│   └── contract.ts          # Shared TypeScript Domain & API Contracts
├── backend/                 # Express + TypeScript + SQLite (node:sqlite) + Scraper & Notifier
│   ├── src/
│   │   ├── auth/            # JWT Auth, Personal Quick-Login & Rate Limiter
│   │   ├── db/              # SQLite Database & Repositories
│   │   ├── notifications/   # Telegram, Discord, LINE, Webhook Dispatchers
│   │   ├── routes/          # REST API Endpoints
│   │   ├── scheduler/       # Background Cron Polling Engine
│   │   ├── scraper/         # Hybrid URL Fetcher & Smart HTML Chapter Extractor
│   │   └── security/        # Socket-level SSRF Guard & Security Headers
│   └── tests/               # 40 Automated Unit, Integration & Security Tests (Vitest)
└── frontend/                # Next.js (App Router) + TypeScript + Tailwind CSS Dashboard
    └── src/
        ├── app/             # Next.js App Router (layout.tsx, page.tsx)
        ├── api/             # Typed API Boundary Client
        ├── components/      # Dashboard, MangaCard, AddMangaModal, NotificationChannelsModal
        └── utils/           # Browser Notification & URL Sanitizer
```

---

## 🚀 วิธีติดตั้งและรันใช้งาน (Getting Started)

### 1. ติดตั้ง Dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. รันระบบในโหมดพัฒนา (Development)

เปิด Terminal 2 หน้าต่าง (หรือรันจาก Root):

```bash
# Terminal 1: รัน Backend API & Background Scheduler (พอร์ต 4000)
npm run dev:backend

# Terminal 2: รัน Frontend Next.js App Router (พอร์ต 3000)
npm run dev:frontend
```

จากนั้นเปิดเบราว์เซอร์ไปที่ `http://localhost:3000`
- ในโหมดเริ่มต้น (**Personal Mode**) สามารถกดปุ่ม **"เข้าใช้งานโหมดส่วนตัว (1-Click Personal Access)"** เพื่อเข้าใช้งานได้ทันที (หรือล็อกอินด้วย `admin` / `admin123`)

### 3. รันการทดสอบและ Build (Verification)

```bash
# รันชุดทดสอบ Backend & Security ทั้งหมด (40 Tests)
npm run test:backend

# Build ทั้ง Backend และ Frontend
npm run build
```
