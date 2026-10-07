# BiDi Flow Navigator 🧭

[![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-7C3AED?logo=obsidian&logoColor=white)](https://obsidian.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Latest Release](https://img.shields.io/badge/release-v1.2.0-emerald.svg)](https://github.com/mohamad-javad/BCN-bidi-content-nvigator-/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**BiDi Flow Navigator** is a modern, high-performance document heading outline and navigator plugin for [Obsidian](https://obsidian.md). Engineered with first-class support for **Bidirectional (BiDi) typography (Persian, Arabic, and mixed RTL/LTR)**, it provides smooth section-by-section navigation, real-time scroll-spy, a 3-mode flexible window system, reading progress calculation, cross-mode scroll position memory, customizable color themes, synchronized auto-scrolling, and instant search.

---

## ✨ Key Features

- **🌐 First-Class BiDi & RTL Typography:**
  Built with modern CSS Logical Properties (`margin-inline-start`, `border-inline-start`, `inset-inline-*`), `dir="auto"`, and `unicode-bidi: plaintext`. Seamlessly handles Persian, Arabic, English, code snippets, numbers, and compound technical terms.

- **⚡ Symmetrical Action Toolbar & Unified Auto-Scroll (`v1.2.0`):**
  - **Symmetrical 5-Button Toolbar:** Features `[⏮️ Prev Sibling]` `[🔼 Prev Part]` `[▶️ Auto Scroll]` `[🔽 Next Part]` `[⏭️ Next Sibling]`.
  - **Cross-Window State Synchronization:** Toggling Auto-Scroll from the floating card, sidebar view, or command palette instantly syncs play/pause indicators and active states across all panels.
  - **Smooth Sub-pixel 60fps Auto-Scroll:** Engineered with fractional pixel accumulators (`autoScrollAccumulator`) and DOM scroll targeting for both Reading View (`.markdown-preview-view`) and Edit View (`.cm-scroller`), supporting speeds from 10 to 200 px/s without stuttering.
  - **Intelligent Deep Heading Jumps:** Sibling jumps on H1/H2 skip nested sub-headings; deep headings (H3+) jump smartly to their parent heading or sibling based on settings.
  - **Shadowless Flat Glass Design:** Clean, modern shadow-free appearance for the floating card and compass toggle pill.

- **🔖 Heading Memory & Cross-Mode Synchronization (`v1.1.11`):**
  - **Remembers Last Heading:** Automatically saves your active reading heading per note and restores your position when reopening notes or restarting Obsidian.
  - **Unified Mode Sync:** Synchronizes your exact reading position when toggling between **Editing View** (Live Preview / Source) and **Reading View** without disruptive jumps to the top of the file.

- **🪟 3-Mode Window System:**
  1. **Compact Pill (`mini`):** A sleek circular floating compass button in the note corner for distraction-free writing.
  2. **Floating Card (`floating`):** Modern glassmorphism floating card with responsive height and quick actions.
  3. **Full-Height Rail (`full-height`):** Full vertical editor height dock for extensive long-form writing and research.
  - Switch between modes with one click using the header window control buttons (`maximize-2` / `minus`).

- **🎯 60fps Scroll-Spy Engine:**
  - Accurately tracks your position in both **Live Preview / Source Mode** (via CodeMirror 6 document height-map measurements) and **Reading View**.
  - High-performance binary search $O(\log N)$ with `requestAnimationFrame` debouncing ensures zero lag even in 10,000+ line notes.

- **🎨 Curated Color Themes & Translucent Styles:**
  - Multiple built-in palettes: **Default Obsidian**, **Dracula**, **Nord**, **Solarized**, and **Gruvbox**.
  - Choose between **Solid** or **Translucent (Glassmorphism)** card finishes.
  - Monolingual localized theme names that dynamically adapt to your selected UI language.

- **📊 Continuous Reading Progress Bar:**
  - Real-time reading progress bar calculated from scroller geometry.
  - Smooth, accurate progress across the entire note without abrupt 0% to 100% jumps.
  - Formatted with Persian digits (`۴۰٪`) or standard numerals (`40%`).

- **🧭 Active Section & Jump Bar (Prev / Current / Next):**
  - Displays the active heading with its level badge (`H1`–`H6`).
  - Next/Previous jump buttons (`‹` / `›`) with heading tooltips for instantaneous navigation.
  - Active section counter (e.g. `۴۱ / ۱۰۸`).

- **🔍 Real-Time Heading Filter & Search:**
  - Filter through hundreds of headings instantly.
  - Auto-expands matching branches while typing.

- **🔤 Clean Language Localization (English / فارسی):**
  - Instant toggle between pure **English** and pure **Persian**.
  - All UI elements, window controls, tooltips, commands, themes, and settings re-render immediately upon selection.

---

## 📸 Screenshots & Showcase

### 🖥️ Unified Dual-Window Showcase (Floating Card & Right Sidebar)

<p align="center">
  <img src="assets/desktop-unified-dark.png" alt="BiDi Flow Navigator Dark Theme" width="32%" />
  &nbsp;
  <img src="assets/desktop-unified-light.png" alt="BiDi Flow Navigator Light Theme" width="32%" />
  &nbsp;
  <img src="assets/desktop-unified-sepia.png" alt="BiDi Flow Navigator Sepia Theme" width="32%" />
</p>
<p align="center">
  <em>BiDi Flow Navigator across Dark, Light, and Warm palettes: Simultaneous floating card and dedicated right sidebar outline with synchronized 5-button bottom toolbar and Persian heading numerals.</em>
</p>

### 📱 Mobile Experience & Settings

<p align="center">
  <img src="assets/mobile-dark-mode.jpg" alt="BiDi Flow Mobile Dark Mode" width="30%" />
  &nbsp;&nbsp;
  <img src="assets/mobile-light-mode.jpg" alt="BiDi Flow Mobile Light Mode" width="30%" />
  &nbsp;&nbsp;
  <img src="assets/settings-view.png" alt="BiDi Flow Settings Tab" width="35%" />
</p>
<p align="center">
  <em>Left & Center: Native mobile experience with touch-optimized outline in Dark & Light modes. Right: Comprehensive configuration tab with pure language switching, toolbar customization, and auto-scroll speed controls.</em>
</p>

---

## 📥 Installation

### Method 1: Using BRAT (Recommended for Beta)
1. Install the **Obsidian42 - BRAT** community plugin.
2. In BRAT settings, click **Add Beta plugin**.
3. Enter this repository URL:
   ```text
   https://github.com/mohamad-javad/BCN-bidi-content-nvigator-
   ```
4. Click **Add Plugin** and enable **BiDi Flow Navigator** in Obsidian's Community Plugins list.

### Method 2: Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [GitHub Release](https://github.com/mohamad-javad/BCN-bidi-content-nvigator-/releases).
2. Create a folder named `bidi-flow-navigator` inside your vault:
   ```bash
   <Your-Vault>/.obsidian/plugins/bidi-flow-navigator/
   ```
3. Copy the downloaded files into that folder.
4. Reload Obsidian (`Ctrl + R`) and enable **BiDi Flow Navigator** under **Settings > Community plugins**.

---

## ⌨️ Command Palette

Press `Ctrl + P` (or `Cmd + P` on macOS) to access plugin commands:

| Command | Description |
| :--- | :--- |
| **Open in Sidebar** | Opens the heading navigator in the active sidebar leaf. |
| **Toggle Auto Scroll** | Starts or stops synchronized smooth auto-scrolling. |
| **Jump to Next Part** | Smart page / heading jump forward. |
| **Jump to Previous Part** | Smart page / heading jump backward. |
| **Jump to Next Sibling** | Jumps to the next sibling or parent heading. |
| **Jump to Previous Sibling** | Jumps to the previous sibling or parent heading. |
| **Jump to Next Section** | Scrolls the editor to the next document heading. |
| **Jump to Previous Section** | Scrolls the editor to the previous document heading. |
| **Toggle Floating Navigator** | Toggles the floating widget between minimized pill and expanded card. |
| **Cycle Window Mode** | Cycles through the 3 modes: Mini Pill ➔ Floating Card ➔ Full-Height Rail. |

---

## ⚙️ Configuration

In Obsidian **Settings > BiDi Flow Navigator**:

- **UI Language:** Choose between pure **Persian (فارسی)** or **English**.
- **Show Floating Widget:** Toggle floating widget alongside markdown notes.
- **Floating Position:** Snap widget to the **Right** or **Left** side of your notes.
- **Default Window Mode:** Choose default initial mode (**Floating Card**, **Compact Pill**, or **Full-Height**).
- **Floating Window Width:** Customize width from 200px to 420px (default: 260px).
- **Color Theme:** Select visual color palette (**Default**, **Dracula**, **Nord**, **Solarized**, **Gruvbox**).
- **Theme Style:** Choose between **Solid** or **Translucent**.
- **Bottom Action Toolbar:** Enable or disable the 5-button bottom action toolbar.
- **Auto Scroll Speed:** Set scrolling speed in pixels per second (10 to 200 px/s with real-time tooltip).
- **Deep Heading Jump Target:** Choose whether H3+ headings jump to **Parent Heading** or **Sibling Heading**.
- **Remember Last Heading Position:** Automatically return to the last active heading when reopening notes.
- **Persian Numerals:** Display percentage and section counters in Persian digits (`۱، ۲، ۳...`).
- **Reading Progress Bar:** Show/hide the top progress indicator.
- **Search Filter:** Enable/disable real-time heading search input.
- **Heading Level Badges:** Display colored tags for `H1`–`H6`.

---

## 📋 Changelog

### v1.2.0 (Latest)
- ⚡ **Symmetrical 5-Button Action Toolbar:** Added a 5-button quick navigation toolbar (`[⏮️ Prev Sibling]` `[🔼 Prev Part]` `[▶️ Auto Scroll]` `[🔽 Next Part]` `[⏭️ Next Sibling]`) with individual button toggles.
- 🔄 **Cross-Window Auto-Scroll Synchronization:** Fully unified Auto-Scroll state between the Floating Card and Sidebar View; starting or pausing auto-scroll anywhere updates all instances simultaneously.
- 🎯 **Sub-Pixel 60fps Smooth Auto-Scroll:** Engineered with mathematical float accumulators (`autoScrollAccumulator`) and DOM scroll targeting for both Reading View (`.markdown-preview-view`) and Edit View (`.cm-scroller`), supporting speeds from 10 to 200 px/s without stuttering or stalling.
- 🧠 **Smart Deep Heading Jumps:** For H1 and H2, sibling jumps leap over child sub-headings; for H3+, users can choose to jump to the parent heading (H2/H1) or same-level sibling.
- 🎨 **Shadowless Modern Aesthetic:** Removed drop shadows from floating card windows and pill toggle buttons for a cleaner, flat glassmorphism look.
- ⚙️ **Enhanced Speed Controls:** Dynamic tooltip slider from 10 to 200 px/s and explicit Obsidian restart notices for toolbar configuration changes.

### v1.1.11
- 🔖 **Smart Heading Memory:** Automatically saves your active reading heading per note and restores your position when reopening notes or restarting Obsidian.
- 🔄 **Unified Mode Synchronization:** Eliminated the native Obsidian scroll-reset bug when switching between Edit Mode (Live Preview) and Reading View with asynchronous render retry (`scrollWithRetry`).
- 🎨 **Monolingual Theme Localization:** Theme names dynamically reflect the selected UI language without confusing mixed bilingual text.
- 📱 **Mobile Refinements:** Enhanced touch navigation, scroll isolation, and responsive card sizing for Obsidian mobile.
- 🐛 **Scroll-Spy Stabilization:** Eliminated transient zero-scroll race conditions during container mounting and mode switches.

### v1.1.0
- 🎨 **Themes & Styling:** Introduced color themes (Dracula, Nord, Gruvbox, Solarized) and glassmorphism translucent style presets.
- 🌐 **Instant Language Switcher:** On-the-fly toggling between Persian and English UI without needing to reload Obsidian.

### v1.0.1
- 🚀 **Initial Core Architecture:** 3-mode flexible window system (Mini Pill, Floating Card, Full-Height Rail), bidirectional outline parser, continuous reading progress bar, real-time heading filter, and sidebar panel.

---

<details>
<summary>🇮🇷 <strong>راهنمای فارسی و گزارش تغییرات (Persian Documentation & Changelog)</strong></summary>

### افزونه هدایت‌گر هوشمند بخش‌های سند (BiDi Flow Navigator)

**هدایت‌گر BiDi** یک افزونه پیشرفته و اختصاصی برای نرم‌افزار Obsidian است که فهرست بخش‌ها و سرتیترهای یادداشت‌های شما را شناسایی کرده و تجربه‌ای روان و شیک از ناوبری محتوا ارائه می‌دهد.

#### قابلیت‌های برجسته:
1. **پشتیبانی تراز اول از زبان فارسی و چینش راست‌به‌چپ (BiDi & RTL):** تنظیم خودکار جهت متن، مهار کلمات طولانی، و عدم به‌هم‌ریختگی چینش با اصطلاحات انگلیسی یا کدهای فنی.
2. **نوار کلید ۵تایی متقارن و اسکرول خودکار یکپارچه (نسخه ۱.۲.۰):**
   - نوار کلیدهای پرکاربرد شامل پرش به سرتیتر قبلی، بخش قبلی، اسکرول خودکار روان در مرکز، بخش بعدی، و سرتیتر بعدی.
   - هماهنگی کامل کلیدهای اسکرول خودکار میان پنجره شناور و نوار کناری (Sidebar) به طوری که وضعیت شروع و توقف در هر دو پنجره همگام است.
   - اسکرول روان ۶۰ فریم بر ثانیه با دقت زیرپیکسل در هر دو نمای مطالعه و ویرایش بدون توقف در سرعت‌های پایین (۱۰ تا ۲۰۰ پیکسل بر ثانیه).
   - پرش هوشمند سرتیترها (رد شدن از زیرتیترها در H1 و H2 و پرش به سرتیتر والد در تیترهای عمیق).
   - ظاهر تخت و بدون سایه برای پنجره شناور و آیکون شناور.
3. **حافظه هوشمند آخرین سرتیتر و هماهنگی کامل تغییر مود:** ذخیره آخرین هدینگ مطالعه‌شده به ازای هر یادداشت و بازگشت خودکار به همان نقطه، همراه با هماهنگ‌سازی بی‌نقص موقعیت اسکرول میان حالت ویرایش (Live Preview) و مطالعه (Reading View) بدون بازگشت به ابتدای فایل.
4. **سیستم پنجره ۳ حالته:** دکمه کوچک شناور (Pill)، پنجره شناور کارت (Floating)، و پنل تمام‌قد متصل به صفحه (Full-Height).
5. **تم‌های رنگی متنوع:** تم‌های دراکولا، نورد، سولارایزد، گرووباکس و پیش‌فرض با حالت‌های مات (Solid) و شیشه‌ای (Transparent).
6. **موتور اسکرول اسپای ۶۰ فریم:** تشخیص لحظه‌ای بخش فعال هنگام اسکرول با سرعت فوق‌العاده.
7. **نوار پیشرفت مطالعه پیوسته:** محاسبه دقیق درصد خواندن یادداشت با ارقام فارسی یا انگلیسی.
8. **فیلتر و جستجوی آنی در عناوین:** فیلتر سریع سرتیترها همراه با باز شدن خودکار شاخه‌ها.
9. **قابلیت تغییر کامل زبان (فارسی / انگلیسی):** انتخاب زبان مستقل برای کل محیط افزونه و صفحه تنظیمات.

</details>

---

## 🛠️ Development & Building

To build the plugin from source:

```bash
# Clone the repository
git clone https://github.com/mohamad-javad/BCN-bidi-content-nvigator-.git
cd BCN-bidi-content-nvigator-

# Install dependencies
npm install

# Start development mode with auto-rebuild
npm run dev

# Build production bundle
npm run build
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/mohamad-javad/BCN-bidi-content-nvigator-/issues).
