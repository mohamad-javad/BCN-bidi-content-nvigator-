# BiDi Flow Navigator 🧭

[![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-7C3AED?logo=obsidian&logoColor=white)](https://obsidian.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Latest Release](https://img.shields.io/badge/release-v1.1.11-emerald.svg)](https://github.com/mohamad-javad/BCN-bidi-content-nvigator-/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**BiDi Flow Navigator** is a modern, high-performance document heading outline and navigator plugin for [Obsidian](https://obsidian.md). Engineered with first-class support for **Bidirectional (BiDi) typography (Persian, Arabic, and mixed RTL/LTR)**, it provides smooth section-by-section navigation, real-time scroll-spy, a 3-mode flexible window system, reading progress calculation, position memory across mode switches, customizable color themes, and instant search.

---

## ✨ Key Features

- **🌐 First-Class BiDi & RTL Typography:**
  Built with modern CSS Logical Properties (`margin-inline-start`, `border-inline-start`, `inset-inline-*`), `dir="auto"`, and `unicode-bidi: plaintext`. Seamlessly handles Persian, Arabic, English, code snippets, numbers, and compound technical terms.

- **🔖 Heading Memory & Cross-Mode Synchronization (`v1.1.11`):**
  - **Remembers Last Heading:** Automatically saves your active reading heading per note and restores your position when reopening notes or restarting Obsidian.
  - **Unified Mode Sync:** Perfectly synchronizes your exact reading position when toggling between **Editing View** (Live Preview / Source) and **Reading View** without disruptive jumps to the top of the file.

- **🪟 3-Mode Window System:**
  1. **Compact Pill (`mini`):** A sleek circular floating compass button in the note corner for distraction-free writing.
  2. **Floating Card (`floating`):** Modern glassmorphism floating card with soft shadows, responsive height, and quick actions.
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

- **📱 Fully Responsive (Desktop & Mobile):**
  - Tuned for both desktop multi-pane workspaces and mobile touch interactions.

---

## 📸 Screenshots & Showcase

### 🖥️ Desktop Experience (Light & Dark)

<p align="center">
  <img src="assets/desktop-dark-showcase.png" alt="BiDi Flow Navigator Desktop Dark Mode" width="48%" />
  &nbsp;&nbsp;
  <img src="assets/desktop-light-showcase.png" alt="BiDi Flow Navigator Desktop Light Mode" width="48%" />
</p>
<p align="center">
  <em>BiDi Flow Navigator in Desktop Workspaces: Floating outline card and dedicated right sidebar outline with active section tracking in Dark Mode (Dracula) and Light Mode.</em>
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
  <em>Left & Center: Native mobile experience with touch-optimized outline in Dark & Light modes. Right: Comprehensive configuration tab with pure language switching and theme customization.</em>
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
- **Remember Last Heading Position:** Automatically return to the last active heading when reopening notes.
- **Persian Numerals:** Display percentage and section counters in Persian digits (`۱، ۲، ۳...`).
- **Reading Progress Bar:** Show/hide the top progress indicator.
- **Search Filter:** Enable/disable real-time heading search input.
- **Heading Level Badges:** Display colored tags for `H1`–`H6`.
- **Indentation Step:** Adjust indentation distance for nested sub-headings (in pixels).
- **Max Heading Level:** Filter headings deeper than specified level (up to H6).

---

## 📋 Changelog

### v1.1.11 (Latest)
- 🔖 **Smart Heading Memory:** Automatically saves your active reading heading per note and restores your position when reopening notes or restarting Obsidian.
- 🔄 **Unified Mode Synchronization:** Eliminated the native Obsidian scroll-reset bug when switching between Edit Mode (Live Preview) and Reading View with asynchronous render retry (`scrollWithRetry`).
- 🎨 **Monolingual Theme Localization:** Theme names dynamically reflect the selected UI language without confusing mixed bilingual text.
- 📱 **Mobile Refinements:** Enhanced touch navigation, scroll isolation, and responsive card sizing for Obsidian mobile.
- 🐛 **Scroll-Spy Stabilization:** Eliminated transient zero-scroll race conditions during container mounting and mode switches.

### v1.1.0
- 🎨 **Themes & Styling:** Introduced color themes (Dracula, Nord, Gruvbox, Solarized) and glassmorphism translucent style presets.
- 🌐 **Instant Language Switcher:** On-the-fly toggling between Persian and English UI without needing to reload Obsidian.

### v1.0.1
- 🚀 **Initial Release:** 3-mode flexible window system (Mini Pill, Floating Card, Full-Height Rail), bidirectional outline parser, continuous reading progress bar, real-time heading filter, and sidebar panel.

---

<details>
<summary>🇮🇷 <strong>راهنمای فارسی (Persian Documentation)</strong></summary>

### افزونه هدایت‌گر هوشمند بخش‌های سند (BiDi Flow Navigator)

**هدایت‌گر BiDi** یک افزونه پیشرفته و اختصاصی برای نرم‌افزار Obsidian است که فهرست بخش‌ها و سرتیترهای یادداشت‌های شما را شناسایی کرده و تجربه‌ای روان و شیک از ناوبری محتوا ارائه می‌دهد.

#### قابلیت‌های برجسته:
1. **پشتیبانی تراز اول از زبان فارسی و چینش راست‌به‌چپ (BiDi & RTL):** تنظیم خودکار جهت متن، مهار کلمات طولانی، و عدم به‌هم‌ریختگی چینش با اصطلاحات انگلیسی یا کدهای فنی.
2. **حافظه هوشمند آخرین سرتیتر و هماهنگی کامل تغییر مود:** ذخیره آخرین هدینگ مطالعه‌شده به ازای هر یادداشت و بازگشت خودکار به همان نقطه، همراه با هماهنگ‌سازی بی‌نقص موقعیت اسکرول میان حالت ویرایش (Live Preview) و مطالعه (Reading View) بدون بازگشت به ابتدای فایل.
3. **سیستم پنجره ۳ حالته:**
   - **دکمه کوچک شناور (Pill):** دکمه گرد و ظریف قطب‌نما در گوشه یادداشت برای تمرکز کامل بر نوشتن.
   - **پنجره شناور کارت (Floating):** کارت شیشه‌ای مدرن با سایه ملایم و کنترل سریع.
   - **تمام‌قد به اندازه کل صفحه (Full-Height):** پنل عمودی متصل به لبه صفحه مناسب اسناد بسیار طولانی.
4. **تم‌های رنگی متنوع و جلوه شیشه‌ای:** پشتیبانی از تم‌های اختصاصی دراکولا (Dracula)، نورد (Nord)، سولارایزد (Solarized)، گرووباکس (Gruvbox) و پیش‌فرض، با نام‌های تک‌زبانه هماهنگ با زبان محیط.
5. **موتور اسکرول اسپای ۶۰ فریم:** تشخیص لحظه‌ای بخش فعال هنگام اسکرول با سرعت فوق‌العاده در هر دو نمای Live Preview و Reading View.
6. **نوار پیشرفت مطالعه پیوسته:** محاسبه دقیق درصد خواندن یادداشت بدون پرش‌های ناگهانی با ارقام فارسی یا انگلیسی.
7. **نوار هدایت سه‌گانه (قبلی / جاری / بعدی):** دکمه‌های پرش مستقیم به بخش‌های پیشین و پسین سند همراه با تولتیپ بومی ابسیدین.
8. **فیلتر و جستجوی آنی در عناوین:** فیلتر سریع سرتیترها همراه با باز شدن خودکار شاخه‌ها.
9. **قابلیت تغییر کامل زبان (فارسی / انگلیسی):** انتخاب زبان مستقل برای کل محیط افزونه و صفحه تنظیمات بدون ترکیب نامناسب متن‌های دوزبانه.
10. **سازگاری کامل با موبایل و دسکتاپ:** طراحی کاملاً واکنش‌گرا برای کار با تبلت، موبایل و نمایشگرهای بزرگ دسکتاپ.

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
