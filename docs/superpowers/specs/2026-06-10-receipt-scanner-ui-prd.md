# PRD — Smart Receipt Scanner: Modern Funky UI

**Date:** 2026-06-10
**Status:** Draft
**Author:** Rizki Autentika + Claude
**Parent Spec:** `2026-06-06-receipt-scanner-telegram-design.md`

---

## 1. Tujuan

Mendesain dan mengimplementasikan UI Flutter app **Smart Receipt Scanner** dengan tema **Modern Funky** — visual yang bold, playful, namun tetap fungsional dan profesional untuk pengguna bisnis kecil.

## 2. Design Principles

| Principle | Deskripsi |
|---|---|
| **Bold & Playful** | Warna cerah, gradasi, dan bentuk rounded yang kuat. Tidak membosankan. |
| **Clear Hierarchy** | Informasi keuangan harus mudah dibaca meskipun visual playful. |
| **Joyful Interactions** | Micro-animations dan feedback yang menyenangkan di setiap aksi. |
| **Consistent Spacing** | Grid system 8pt untuk spacing, padding, dan sizing yang konsisten. |
| **Accessible** | Kontras warna memenuhi WCAG AA. Font size minimum 14px untuk body text. |

## 3. Design Token / Style Guide

### 3.1 Color Palette

```
Primary
  ├── Grape Purple     #7C3AED  (actions, buttons, active states)
  ├── Hot Pink         #EC4899  (highlights, badges, accents)
  └── Gradient         linear-gradient(135deg, #7C3AED → #EC4899)

Secondary
  ├── Electric Blue    #3B82F6  (links, info states)
  ├── Sunshine Yellow  #FBBF24  (warnings, highlights, star ratings)
  └── Mint Green       #34D399  (success, confirmed status)

Neutral
  ├── Background       #F8F7FF  (light lavender white)
  ├── Surface          #FFFFFF  (cards, modals)
  ├── Text Primary     #1E1B4B  (deep indigo, bukan pure black)
  ├── Text Secondary   #6B7280  (gray for captions)
  └── Border           #E5E7EB  (subtle borders)

Status
  ├── Needs Review     #F59E0B  (amber)
  ├── Confirmed        #10B981  (green)
  └── Error            #EF4444  (red)
```

### 3.2 Typography

```
Font Family: Poppins (Google Fonts)

Display    — 28px / Bold      (page titles)
Headline   — 22px / SemiBold  (section headers)
Title      — 18px / SemiBold  (card titles)
Body       — 14px / Regular   (general text)
Caption    — 12px / Regular   (timestamps, labels)
Overline   — 10px / Medium    (badges, chips)

Line height: 1.5× font size
```

### 3.3 Shapes & Elevation

```
Border Radius
  ├── Cards / Containers   20px
  ├── Buttons              14px
  ├── Input Fields         12px
  ├── Chips / Badges        8px (pill shape = full round)
  └── Bottom Sheet         24px (top corners only)

Shadows (funky layered)
  ├── Level 1  0 2px 8px rgba(124,58,237,0.08)     (subtle cards)
  ├── Level 2  0 4px 16px rgba(124,58,237,0.12)    (elevated cards)
  └── Level 3  0 8px 32px rgba(124,58,237,0.16)    (modals, FAB)

Glassmorphism (selected overlays)
  background: rgba(255,255,255,0.7)
  backdrop-filter: blur(12px)
  border: 1px solid rgba(255,255,255,0.3)
```

### 3.4 Icons & Illustrations

- **Icon style:** Rounded bold icons (Phosphor Icons — bold variant)
- **Empty states:** Custom playful illustrations (vector, flat style dengan warna palette)
- **Illustrations:** Hand-drawn feel dengan warna funky, bukan stock corporate

### 3.5 Animation & Motion

```
Duration
  ├── Micro (button press, toggle)      150ms
  ├── Small (chip select, badge)        250ms
  ├── Medium (page transition, card)    350ms
  └── Large (bottom sheet, modal)       450ms

Curve: Curves.easeOutCubic (default)

Transitions
  ├── Page transition       Slide + fade (kanan ke kiri)
  ├── Card tap              Scale 0.98 → 1.0 dengan shadow change
  ├── FAB                   Bounce-in on screen load
  ├── List items            Staggered fade-in (50ms delay per item)
  └── Pull-to-refresh       Custom animated receipt icon spinning
```

---

## 4. Screen-by-Screen Requirements

### 4.1 Splash & Onboarding

**Splash Screen**
- Gradient background (Primary gradient)
- App logo dengan scale-in animation (400ms, easeOutBack)
- Tagline: "Smart Receipts, Zero Hassle" — fade-in setelah logo muncul
- Durasi total: 2 detik, lalu auto-navigate ke Login atau Home

**Onboarding (first-time only, 3 slides)**
- Swipeable cards dengan illustration besar di atas, teks di bawah
- Indikator dots (gradient active dot, gray inactive)
- Slide 1: "Snap & Send via Telegram" — ilustrasi phone + telegram
- Slide 2: "Auto-Extract Your Receipts" — ilustrasi OCR scanning
- Slide 3: "Track & Report" — ilustrasi chart + dashboard
- Tombol "Get Started" muncul di slide 3 (fade-in)

### 4.2 Login / Signup

**Layout**
- Gradient background (top 40% gradient, bottom 60% white)
- App logo di area gradient
- Card putih rounded yang "float" dari bawah menutupi area transisi

**Login Form**
- Email input — leading icon, rounded border, purple focus ring
- Password input — leading icon, show/hide toggle, rounded border
- "Sign In" button — full-width, gradient, bold text, scale animation on tap
- "Sign in with Google" — outlined button dengan Google icon
- "Don't have an account? Sign Up" — link text

**Signup Form**
- Nama, Email, Password, Confirm Password
- Password strength indicator (color bar: red → yellow → green)
- Success: confetti animation → navigate to Home

### 4.3 Home Screen

**Layout (2-section scrollable)**
```
┌─────────────────────────────────┐
│  Header: gradient background    │
│  "Halo, Rizki! 👋"             │
│  Bulan ini: Rp 4.250.000       │
│                                 │
│  ┌───────────┐ ┌───────────┐   │
│  │ 3 Receipts│ │ 2 Pending │   │  ← Summary cards (glassmorphism)
│  │  Confirmed│ │  Review   │   │
│  └───────────┘ └───────────┘   │
│                                 │
│  Category Breakdown             │
│  [====Transport 45%====]       │  ← Horizontal stacked bar
│  [===Supplies 30%===]          │
│  [==Other 25%==]               │
│                                 │
│  Recent Receipts          See ▸ │
│  ┌─────────────────────────┐   │
│  │ 🏪 Toko Maju Jaya       │   │  ← Receipt card
│  │ Rp 250.000 · Transport  │   │
│  │ Today, 14:30            │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ 🏪 Alfamart             │   │
│  │ Rp 85.000 · Supplies    │   │
│  │ Yesterday, 09:15        │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────┐      ┌─────┐          │
│  │Home │      │Report│          │  ← Bottom nav
│  └─────┘      └─────┘          │
└─────────────────────────────────┘
```

**Components:**
- **Header:** Gradient background, greeting text, monthly total besar (Poppins Bold)
- **Summary cards:** 2-column grid, glassmorphism background, icon + angka + label
- **Category bar:** Horizontal stacked bar dengan warna per kategori, persentase label
- **Recent receipts:** Vertical card list, staggered animation on load. Setiap card punya:
  - Leading: category icon dalam colored circle
  - Title: merchant name (SemiBold)
  - Subtitle: amount + category badge
  - Trailing: relative timestamp + status dot (amber/green)
- **Bottom nav:** 2 tabs (Home, Reports) dengan active indicator gradient + icon fill

**Interactions:**
- Pull-to-refresh: custom animation (receipt icon berputar)
- Tap card → navigate to Receipt Detail (hero animation pada card)
- Tap "See all" → navigate to Receipt List

### 4.4 Telegram Linking Screen

**Layout**
- Ilustrasi besar di tengah (phone + telegram icon, playful style)
- Status badge: "Connected" (hijau) atau "Not Connected" (abu)

**Jika belum connect:**
- "Connect Telegram" button (gradient, besar)
- Tap → generate 6-digit code
- Tampilan kode besar di tengah (font 48px, Poppins Bold, gradient text)
- Timer countdown 10 menit di bawah kode (circular progress)
- Instruksi step-by-step:
  1. Buka Telegram
  2. Cari bot @SmartReceiptBot
  3. Kirim `/link KODE123`
- Copy button di samping kode

**Jika sudah connect:**
- Telegram username terlihat
- "Disconnect" button (outlined, red accent)
- Konfirmasi dialog sebelum disconnect

### 4.5 Receipt List Screen

**Layout**
```
┌─────────────────────────────────┐
│  ← Receipts            🔍  ⊕   │  ← App bar dengan search & add
│                                 │
│  [All] [Needs Review] [Done]    │  ← Filter chips (horizontal scroll)
│                                 │
│  Sort: Terbaru ▾                │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 🏪 Toko Maju Jaya       │   │
│  │ Rp 250.000              │   │
│  │ Transport · Today       │   │
│  │         ● Needs Review  │   │
│  └─────────────────────────┘   │
│  ...                            │
└─────────────────────────────────┘
```

**Features:**
- Search bar expandable (tap icon → expand ke full search field dengan animation)
- Filter chips: All / Needs Review / Confirmed — pill-shaped, gradient active state
- Sort dropdown: Terbaru, Tertua, Jumlah Terbesar, Jumlah Terkecil
- Date range filter (tap icon → bottom sheet date picker)
- Empty state: playful illustration + "No receipts yet. Send one via Telegram!"
- Swipe-to-delete pada card (red background terungkap, konfirmasi dialog)

### 4.6 Receipt Detail Screen

**Layout**
```
┌─────────────────────────────────┐
│  ← Receipt Detail         ✏️   │
│                                 │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  │   [Receipt Image]       │   │  ← Hero image, rounded corners
│  │   tap to zoom           │   │
│  └─────────────────────────┘   │
│                                 │
│  Status: ● Needs Review        │  ← Status badge (colored)
│                                 │
│  Merchant                       │
│  ┌─────────────────────────┐   │
│  │ Toko Maju Jaya          │   │  ← Editable field
│  └─────────────────────────┘   │
│  Amount                         │
│  ┌─────────────────────────┐   │
│  │ Rp 250.000              │   │
│  └─────────────────────────┘   │
│  Category                       │
│  [Transport] [Supplies] [Other] │  ← Category chips
│  Date                           │
│  ┌─────────────────────────┐   │
│  │ 10 June 2026            │   │
│  └─────────────────────────┘   │
│                                 │
│  Items                          │
│  ┌─────────────────────────┐   │
│  │ Pertamax 5L   Rp 65.000│   │
│  │ Minyak 2L     Rp 36.000│   │
│  └─────────────────────────┘   │
│                                 │
│  [    Confirm Receipt    ]      │  ← CTA button (gradient)
└─────────────────────────────────┘
```

**Features:**
- Receipt image: tap → fullscreen overlay (pinch to zoom, swipe dismiss)
- Semua field editable (inline edit mode)
- Category selection: chip selector dengan icon per kategori
- Items list: tambah/hapus item
- "Confirm" button: gradient besar di bottom, shake animation jika ada field kosong
- Setelah confirm: success animation (checkmark lottie) → kembali ke list

### 4.7 Reports Screen

**Layout**
```
┌─────────────────────────────────┐
│  Reports                        │
│                                 │
│  [June 2026 ▾]                  │  ← Month selector
│                                 │
│  Total Spending                 │
│  Rp 4.250.000                   │  ← Besar, gradient text
│  ↑ 12% from last month         │  ← Trend indicator
│                                 │
│  ┌─────────────────────────┐   │
│  │  Bar Chart              │   │  ← Category breakdown (fl_chart)
│  │  Transport ███████ 45%  │   │  ← Bars dengan rounded tops
│  │  Supplies  █████  30%   │   │
│  │  Other     ████   25%   │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │  Line Chart             │   │  ← Daily spending trend
│  │  /\  /\    /\           │   │  ← Gradient area fill
│  │ /  \/  \/\/  \          │   │
│  └─────────────────────────┘   │
│                                 │
│  [  Export CSV  ]               │  ← Outlined button
│                                 │
│  ┌─────┐      ┌─────┐          │
│  │Home │      │Report│          │
│  └─────┘      └─────┘          │
└─────────────────────────────────┘
└─────────────────────────────────┘
```

**Chart Styling:**
- Bar chart: rounded top corners (radius 8px), warna per kategori dari palette
- Line chart: gradient fill area di bawah line, smooth curves
- Touch tooltip: rounded card dengan shadow, menampilkan nilai detail
- Animasi: bars grow up / line draws in saat screen load (800ms)

### 4.8 Settings Screen

**Layout:**
- Profile section: avatar circle (initials atau foto), nama, email
- Menu items dengan leading icon, trailing chevron:
  - Telegram Connection → navigasi ke linking screen
  - Notification Preferences → toggle switches
  - Default Currency → dropdown
  - About → app version, licenses
  - Log Out → red text, konfirmasi dialog
- Divider antar section

---

## 5. Shared Components Library

### 5.1 Buttons

| Type | Style | Usage |
|---|---|---|
| **Primary** | Gradient fill, white text, 14px radius, shadow L2 | CTA utama (Confirm, Sign In) |
| **Secondary** | Purple outline, purple text, no fill | Secondary actions |
| **Ghost** | Transparent, purple text | Tertiary / cancel |
| **Icon** | Circular, icon centered, subtle bg | Toolbar actions |
| **FAB** | Gradient, 56px circle, shadow L3, bounce-in | Tambah receipt manual |

### 5.2 Cards

- Background: white, border-radius 20px, shadow L1
- Tap: scale 0.98 + shadow L2 → navigate
- Variant: **Glassmorphism card** untuk summary stats di Home

### 5.3 Input Fields

- Border: 1px gray, 12px radius
- Focus: purple border 2px + subtle purple glow
- Error: red border + shake animation + error text below
- Label: overline style above field
- Icon: leading 20px, purple when focused

### 5.4 Badges & Chips

- **Status badge:** pill shape, colored bg (10% opacity), colored text
- **Category chip:** icon + label, selectable, gradient active state
- **Filter chip:** text only, rounded, border when inactive, fill when active

### 5.5 Bottom Sheet

- Top radius 24px
- Drag handle (small gray bar di tengah atas)
- Content slide-up dengan curve easeOutCubic
- Backdrop blur (glassmorphism di background)

### 5.6 Dialog / Modal

- Centered, rounded 20px
- Backdrop: dark semi-transparent + blur
- Entrance: scale 0.9 → 1.0 + fade (250ms)
- Title (Headline), body (Body), actions (buttons row di bawah)

### 5.7 Toast / Snackbar

- Bottom positioned, above bottom nav
- Rounded 14px, colored left accent bar
- Icon + message + optional action
- Slide up + fade in (250ms), auto-dismiss 3 detik

---

## 6. Responsive & Platform

| Aspek | Android | iOS |
|---|---|---|
| Navigation | Material bottom nav | Cupertino-style jika lebih natural |
| Back gesture | Back button di app bar | Swipe-back gesture |
| Haptic | Haptic feedback pada button tap, confirm | Sama |
| Status bar | Transparent, dark icons | Transparent, dark icons |
| Safe area | Handle notch & bottom bar | Sama |

**Responsive breakpoints (untuk tablet / iPad):**
- Phone: single column layout (default)
- Tablet (>600px): 2-column untuk receipt list, sidebar navigation

---

## 7. Dark Mode

Dark mode mengikuti design token yang disesuaikan:

```
Background     #0F0E1A  (deep purple-black)
Surface        #1A1826  (dark card)
Text Primary   #F1F0F5  (light lavender)
Text Secondary #9CA3AF  (gray)
Gradient       linear-gradient(135deg, #8B5CF6 → #F472B6)

Shadow → tidak digunakan, diganti border subtle
```

Semua warna status dan accent tetap sama, hanya background dan text yang berubah. Toggle dark mode di Settings.

---

## 8. Animations Detail

| Event | Animation | Detail |
|---|---|---|
| Page enter | Slide + fade | Dari kanan, 350ms easeOutCubic |
| Page exit | Slide + fade | Ke kiri, 250ms easeIn |
| Card tap | Scale down | 0.98, 150ms, spring back |
| Button press | Scale down + shadow shrink | 0.95, 150ms |
| List load | Staggered fade-in | 50ms delay per item, slide up 20px |
| Success action | Lottie checkmark | 600ms, gradient checkmark |
| Error | Shake + red flash | 3× oscillation, 300ms |
| Pull refresh | Custom spin | Receipt icon rotasi 360° |
| FAB appear | Bounce-in | Scale 0→1 dengan overshoot |
| Bottom sheet | Slide up | Dari bawah, 450ms easeOutCubic |
| Tab switch | Cross-fade | 200ms |
| Chart load | Grow / draw in | Bars grow, line draws, 800ms |
| Toggle switch | Slide + color change | 200ms easeInOut |

---

## 9. Accessibility

- Semua interactive elements punya `semanticsLabel`
- Minimum tap target: 48×48px
- Color contrast ratio minimum 4.5:1 (WCAG AA)
- Tidak mengandalkan warna saja untuk convey status (gunakan icon + text juga)
- Screen reader friendly: logical reading order, descriptive labels
- Font scaling: support dynamic font size hingga 1.5×

---

## 10. Performance Target

| Metric | Target |
|---|---|
| Screen load time | < 300ms |
| Animation FPS | 60fps (no jank) |
| Image load | Lazy load + thumbnail, full load on tap |
| List scroll | Smooth dengan `ListView.builder` |
| Time to Interactive | < 1s setelah splash |

---

## 11. Flutter Packages

| Package | Purpose |
|---|---|
| `google_fonts` | Poppins font loading |
| `fl_chart` | Charts (bar, line) dengan custom styling |
| `lottie` | Success/error animations |
| `animations` | Page transitions, staggered animations |
| `flutter_svg` | Custom SVG illustrations & icons |
| `phosphor_flutter` | Icon set (bold variant) |
| `shimmer` | Loading placeholder effect |
| `cached_network_image` | Receipt image caching |
| `photo_view` | Image zoom pada receipt detail |
| `flutter_slidable` | Swipe-to-delete pada receipt cards |
| `intl` | Currency (IDR) & date formatting |
| `provider` / `flutter_riverpod` | State management |

---

## 12. Out of Scope (MVP)

- Custom illustration creation (gunakan placeholder atau free illustrations dulu)
- Lottie animation custom (gunakan free dari LottieFiles)
- Tablet-specific layout optimization
- Web/desktop support
- Theme customization oleh user (selain light/dark toggle)
