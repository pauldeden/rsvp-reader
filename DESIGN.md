# RSVP Reader — Design Document

> **RSVP** stands for **Rapid Serial Visual Presentation** — a scientifically-backed speed reading
> technique that displays one word at a time at a fixed focal point, eliminating eye movement
> (saccades) and enabling reading speeds of 300–1000+ WPM with maintained comprehension.

> A free, offline-capable PWA for RSVP speed reading.
> Hosted on GitHub Pages. Inspired by the look and feel of Blinkword for iOS.

---

## 1. Project Goals

| Goal | Detail |
|------|--------|
| **Cost** | $0 — static files on GitHub Pages, no backend |
| **Installable** | Full PWA — "Add to Home Screen" on iOS & Android |
| **Offline** | Service worker caches all assets; works on a plane or while camping |
| **Speed range** | 300–1000+ WPM with live adjustment while reading |
| **Storage** | All data in browser (IndexedDB for texts, localStorage for settings) |
| **Language** | Full support for English and Brazilian Portuguese (pt-BR) text |
| **Deployment** | `git push` to `main` → GitHub Pages auto-deploys |

---

## 2. Visual Design — "Blinkword-Inspired"

### 2.1 Color Palette (Dark-First)

The primary theme mirrors Blinkword's dark, immersive aesthetic:

| Role | Color | Hex |
|------|-------|-----|
| **Background** | Deep charcoal / near-black | `#1A1A2E` |
| **Surface** (cards, modals) | Dark navy | `#16213E` |
| **Primary accent** | Coral red (anchor letter, active controls) | `#E94560` |
| **Secondary accent** | Soft blue (links, secondary actions) | `#0F3460` |
| **Text — primary** | White | `#FFFFFF` |
| **Text — secondary** | Muted gray | `#A0A0B0` |
| **Success / progress** | Teal | `#00D9A6` |
| **Speed indicator** | Warm amber | `#F5A623` |

### 2.2 Typography

- **Reading word display:** System sans-serif stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`)
- **Word size:** Large — minimum 36px on mobile, up to 64px on desktop
- **Anchor letter:** The letter at or near the Optimal Recognition Point (ORP) is rendered in the coral red accent (`#E94560`) while the rest of the word stays white
- **UI text:** 14–16px, regular weight for controls and labels

### 2.3 Layout Principles

- Minimal chrome — the reading word dominates the screen
- Dark background reduces eye strain for extended reading
- High contrast between text and background for readability at speed
- Generous whitespace; no clutter
- All interactive elements are large enough for thumb use on mobile (min 44×44px touch targets)

---

## 3. Architecture

### 3.1 Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Markup** | HTML5 | Semantic, accessible |
| **Styling** | CSS3 (single file, no preprocessor) | Keep it simple; CSS custom properties for theming |
| **Logic** | Vanilla JavaScript (ES modules) | Zero dependencies = tiny bundle, instant load, full offline |
| **Storage** | IndexedDB (via simple wrapper) + localStorage | IndexedDB for texts (large), localStorage for settings (small) |
| **PWA** | manifest.json + service worker | Installability + offline caching |
| **Hosting** | GitHub Pages | Free, automated deploy on push |

### 3.2 File Structure

```
rsvp-reader/
├── index.html              # Single-page app shell
├── css/
│   └── style.css           # All styles, CSS custom properties for theme
├── js/
│   ├── app.js              # App initialization, screen routing
│   ├── reader.js           # RSVP engine (timing, word display, ORP calc)
│   ├── storage.js          # IndexedDB + localStorage wrapper
│   └── clipboard.js        # Clipboard paste handler
├── sw.js                   # Service worker (stale-while-revalidate for HTML, cache-first for assets)
├── manifest.json           # PWA manifest
├── icons/
│   ├── icon-192.png        # PWA icon
│   └── icon-512.png        # PWA icon
└── DESIGN.md               # This file
```

### 3.3 No Build Step

No bundler, no transpiler, no npm. The files are served as-is. This keeps the project dead simple, reduces maintenance, and ensures anyone can fork and modify it.

---

## 4. Screens & UX Flow

### 4.1 Screen Map

```
┌─────────────┐
│   LIBRARY    │  ← Home screen: list of saved texts
│  (default)   │
└──────┬───────┘
       │ tap a text
       ▼
┌─────────────┐
│   READER     │  ← Full-screen RSVP reading
│              │
└──────┬───────┘
       │ back
       ▼
┌─────────────┐
│   LIBRARY    │
└─────────────┘
```

There are only **two screens**: Library and Reader. Settings are accessed via a minimal overlay/modal from either screen.

### 4.2 Library Screen

**Purpose:** Manage texts to read.

**Layout:**
- Top bar: App title "RSVP Reader" (left), Settings gear icon (right)
- Center: List of saved texts as cards showing:
  - Title (first line or user-assigned)
  - Word count
  - Reading progress (percentage bar in teal `#00D9A6`)
  - Last read date
- Bottom: Single prominent button — **"Paste from Clipboard"** (coral accent)
  - One tap: attempts `navigator.clipboard.readText()`, opens a confirm/title dialog, saves to IndexedDB
  - **Fallback:** If clipboard API is denied/unavailable, a modal with a textarea appears so the user can Ctrl+V / long-press paste manually. The clipboard button is the fast path; the textarea is the reliable path.
  - This is the ONLY way to add text — no file upload, no URL fetch. Maximum simplicity.

**Card actions:**
- Tap card → opens Reader at last position
- Swipe left on card → delete (with confirmation)

### 4.3 Reader Screen

**Purpose:** RSVP speed reading.

**Layout (top to bottom):**

```
┌──────────────────────────────────┐
│  ← Back          3/142 words     │  ← Minimal top bar (auto-hides after 2s)
├──────────────────────────────────┤
│                                  │
│                                  │
│          con·CEPT·ion            │  ← Word display zone (vertically centered)
│            ▲                     │     ORP letter in coral red
│            │                     │
│         focus line               │  ← Thin vertical alignment guide
│                                  │
├──────────────────────────────────┤
│     ◀ 350 WPM ▶                 │  ← Speed control bar (auto-hides with top bar)
│        ▶ / ❚❚                   │  ← Play/Pause
└──────────────────────────────────┘
```

**Core interactions (world-class simplicity):**

| Action | Input | Why |
|--------|-------|-----|
| **Play / Pause** | Tap anywhere on the word area | Largest possible touch target |
| **Speed up** | Swipe right OR tap `▶` button | Increments by 25 WPM |
| **Slow down** | Swipe left OR tap `◀` button | Decrements by 25 WPM |
| **Show/hide controls** | Tap top or bottom bar area | Controls auto-hide for immersion after 2s |
| **Go back** | Tap `←` or swipe down | Returns to Library, position is saved |

**Speed display:** Current WPM shown in amber (`#F5A623`) between the `◀` / `▶` buttons. Updates in real time.

**Progress:** Thin progress bar at very top of screen (teal `#00D9A6`), always visible.

### 4.4 Settings Modal

Accessed via gear icon. Minimal set of options:

| Setting | Control | Default | Persisted |
|---------|---------|---------|-----------|
| Reading speed (WPM) | Slider (100–1200, step 25) | 300 | Yes — localStorage |
| Font size | Slider (28–72px) | 44px | Yes |
| Show anchor letter highlight | Toggle | On | Yes |
| Show focus guide line | Toggle | On | Yes |
| Theme | Dark (v1) | Dark | Yes |
| Clear all data | Button with confirmation | — | — |

---

## 5. RSVP Engine — Technical Design

### 5.1 Timing Model

At 1000 WPM → 60ms per word. At 300 WPM → 200ms per word.

**Formula:** `interval_ms = 60000 / wpm`

**Implementation:** Use `setTimeout` with drift correction, NOT `setInterval`:

```
function scheduleNextWord() {
    const now = performance.now();
    const drift = now - expectedTime;
    expectedTime += interval;
    displayNextWord();
    timer = setTimeout(scheduleNextWord, Math.max(0, interval - drift));
}
```

This prevents cumulative drift over long reading sessions.

**Visibility change:** The reader auto-pauses and saves position when the tab/app loses focus (`document.visibilitychange` event). This prevents words flying by while the user is in another app.

### 5.2 Smart Pausing (Dynamic Timing)

Matches Blinkword's "dynamic timing" — longer words and punctuation get extra display time:

| Condition | Extra time |
|-----------|-----------|
| Word length > 8 chars | +20% |
| Word ends with `,` `;` `:` | +30% |
| Word ends with `.` `!` `?` `…` | +50% |
| Paragraph break | +80% |

Works identically for English and Portuguese text (punctuation rules are the same). Portuguese accented characters (ã, ç, é, etc.) are handled naturally since we operate on Unicode strings.

### 5.3 Optimal Recognition Point (ORP)

The ORP is the letter the eye naturally fixates on. It's calculated as roughly 30% from the start of the word (slightly left of center). This letter is highlighted in coral red.

```
function getORPIndex(word) {
    const len = word.length;
    if (len <= 1) return 0;
    if (len <= 3) return 1;
    return Math.floor(len * 0.3);
}
```

The word is positioned so the ORP letter aligns to a fixed center point on screen. The eye never moves.

---

## 6. Data & Storage

### 6.1 IndexedDB — `rsvp-reader-db`

**Object store: `texts`**

| Field | Type | Description |
|-------|------|-------------|
| `id` | auto-increment | Primary key |
| `title` | string | User-assigned or first ~50 chars |
| `content` | string | Full text |
| `wordCount` | number | Computed on save |
| `currentWord` | number | Reading position (0-indexed) |
| `createdAt` | ISO string | When pasted |
| `lastReadAt` | ISO string | When last opened |

### 6.2 localStorage — Settings

```json
{
  "sr_wpm": 300,
  "sr_fontSize": 44,
  "sr_showORP": true,
  "sr_showGuide": true,
  "sr_theme": "dark"
}
```

Settings are read on app load and written on every change. The reading speed (`sr_wpm`) persists across all reading sessions as required.

---

## 7. PWA & Offline

### 7.1 manifest.json

All paths are **relative** so the app works on any GitHub Pages project URL, forks, or custom domains.

```json
{
  "name": "RSVP Reader",
  "short_name": "RSVP Reader",
  "start_url": ".",
  "scope": ".",
  "display": "standalone",
  "background_color": "#1A1A2E",
  "theme_color": "#1A1A2E",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 7.1.1 iOS-Specific Metadata

Added in `index.html` `<head>` for proper standalone feel on iOS:

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

CSS uses `env(safe-area-inset-*)` for notch/home indicator padding.

### 7.2 Service Worker Strategy

**Stale-while-revalidate** for the HTML app shell (prevents stale-app trap). **Cache-first** for CSS, JS, and icons (immutable per version). On `activate`, old caches are deleted automatically.

```
CACHE_VERSION = 'v1';
PRECACHE_URLS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/reader.js',
  './js/storage.js',
  './js/clipboard.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
```

The service worker is updated by changing `CACHE_VERSION` on deploy. Old caches are purged on `activate`.

### 7.3 Offline Behavior

- App loads fully from cache — no network needed
- All texts are stored in IndexedDB (local to the browser)
- All settings are in localStorage
- **Nothing requires a server** — there is no server. The entire app is client-side.

---

## 8. UX Principles — World-Class Standard

### 8.1 Simplicity

> "If you have to explain it, redesign it."

- **Two screens only** — Library and Reader
- **One button to add content** — "Paste from Clipboard"
- **One gesture to read** — tap to play/pause
- No sign-up. No account. No cloud sync. No ads. No tracking.

### 8.2 Intuitiveness

- Controls follow platform conventions (swipe, tap, back gesture)
- Speed adjustment uses the universal ◀/▶ metaphor
- Visual progress is always visible
- The ORP anchor letter guides the eye without requiring explanation
### 8.3 Effectiveness

- Drift-corrected timing ensures accurate WPM delivery
- Smart pausing at punctuation and long words preserves comprehension
- ORP highlighting reduces subvocalization and eye movement
- Dark theme reduces eye fatigue for extended sessions
- Large, high-contrast text is readable at any speed

### 8.4 Efficiency

- From opening the app to reading: **2 taps** (tap saved text → tap to start)
- From copying text elsewhere to reading: **3 taps** (paste button → confirm → tap to start)
- Speed persists — no re-configuring between sessions
- Reading position persists — pick up exactly where you left off
- Auto-hiding controls maximize reading area
- Offline-first means zero loading time after first install

---

## 9. GitHub Pages Deployment

### 9.1 Repository Setup

```bash
# One-time setup
git init
git remote add origin git@github.com:<username>/rsvp-reader.git
git push -u origin main

# Enable GitHub Pages:
# Settings → Pages → Source: Deploy from branch → main → / (root)
```

### 9.2 Deploy

```bash
git add -A && git commit -m "description" && git push
# GitHub Pages auto-deploys within ~60 seconds
```

### 9.3 Access

- URL: `https://<username>.github.io/rsvp-reader/`
- Install as PWA from the browser's "Add to Home Screen" prompt

---

## 10. Future Enhancements (Out of Scope for v1)

These are explicitly **not** in v1 but noted for potential future work:

- Additional themes (Sepia, Ocean, Midnight) — matches Blinkword's 9 themes
- Import from file (plain text, epub)
- Adjustable ORP position
- Reading statistics / daily goals
- Share/export reading position
- Keyboard shortcuts for desktop use
