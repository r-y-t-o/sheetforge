# Design System — Design Automation Hub

A reference document for implementing the visual design language of the Design Automation Hub web portal. Covers colour tokens, typography, spacing, component patterns, and theme switching for both light and dark modes.

---

## 1. Theme Architecture

The portal uses a **dual-theme CSS custom property system**. Themes are toggled by adding or removing the `.dark` class on the `<html>` element. All colour values are defined as CSS custom properties on `:root` (light) and `.dark` (dark), so every component automatically adapts without per-component overrides.

**Theme persistence:** Store the user's preference in `localStorage` under the key `theme`. Read it and apply the `.dark` class in an **inline `<script>`** in the document `<head>` — before any CSS loads — to prevent a flash of the wrong theme on page load.

```js
// Inline in <head> — must run before first paint
const theme = localStorage.getItem('theme') ||
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
if (theme === 'dark') document.documentElement.classList.add('dark');
```

**Theme toggle:** On click, toggle `.dark` on `<html>` and update `localStorage`.

---

## 2. Colour Tokens

### 2.1 Core Backgrounds

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-bg-primary` | `#FFFFFF` | `#0A0A0A` | Page background |
| `--color-bg-secondary` | `#F9FAFB` | `#111111` | Subtle surface (hero banners, section backs) |
| `--color-bg-card` | `#FFFFFF` | `#161616` | Card backgrounds |
| `--color-bg-card-hover` | `#F3EEFF` | `#1E1E1E` | Card background on hover |

### 2.2 Text

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-text-primary` | `#1A1A2E` | `#F5F5F5` | Headings, body text, labels |
| `--color-text-secondary` | `#6B7280` | `#9CA3AF` | Captions, descriptions, meta |

### 2.3 Accent (Primary Brand Colour)

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-accent` | `#7C3AED` | `#CCFF00` | Buttons, links, icons, active states, borders |
| `--color-accent-hover` | `#6D28D9` | `#B8E600` | Accent on hover |
| `--color-accent-soft` | `rgba(124,58,237,0.10)` | `rgba(204,255,0,0.08)` | Accent-tinted backgrounds (badges, chips) |

> **Light mode** accent is **purple** (`#7C3AED`). **Dark mode** accent is **neon lime green** (`#CCFF00`). These are the most distinctive brand colours and should appear on all interactive/highlighted elements.

### 2.4 CTA (Call-to-Action)

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-cta` | `#EC4899` | `#CCFF00` | Primary action buttons |
| `--color-cta-hover` | `#DB2777` | `#B8E600` | CTA on hover |

### 2.5 Borders

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-border` | `#E5E7EB` | `#262626` | Default borders, dividers |
| `--color-border-hover` | `#7C3AED` | `#CCFF00` | Border on hover (matches accent) |

### 2.6 Shadows

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-card-shadow` | `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` | `0 1px 3px rgba(0,0,0,0.30)` | Resting card shadow |
| `--color-card-shadow-hover` | `0 10px 40px rgba(124,58,237,0.15), 0 4px 12px rgba(124,58,237,0.10)` | `0 10px 40px rgba(204,255,0,0.08), 0 4px 12px rgba(204,255,0,0.05)` | Card shadow on hover (accent-tinted) |
| `--color-glow` | `rgba(124,58,237,0.30)` | `rgba(204,255,0,0.25)` | Glow effects |

### 2.7 Pill / Tag Badges

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-pill-bg` | `#EDE9FE` | `rgba(204,255,0,0.10)` | Primary badge background |
| `--color-pill-text` | `#6D28D9` | `#CCFF00` | Primary badge text |
| `--color-pill-bg-alt` | `#FCE7F3` | `rgba(204,255,0,0.06)` | Secondary badge background (e.g. discipline tags) |
| `--color-pill-text-alt` | `#BE185D` | `#A3CC00` | Secondary badge text |

### 2.8 Navigation

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-nav-bg` | `rgba(255,255,255,0.85)` | `rgba(10,10,10,0.85)` | Sticky nav background (with `backdrop-blur`) |

### 2.9 Feature Card Accents

Used for category-specific accent colours on tool feature cards.

| Token | Light | Dark | Semantic meaning |
|---|---|---|---|
| `--color-feature-health` | `#F59E0B` | `#FBBF24` | Model health / warnings |
| `--color-feature-rules` | `#10B981` | `#34D399` | Rule-based checks |
| `--color-feature-clash` | `#EF4444` | `#F87171` | Clash detection |
| `--color-feature-analytics` | `#6366F1` | `#818CF8` | Analytics / charts |
| `--color-feature-security` | `#10B981` | `#34D399` | Security / data protection |

### 2.10 Architecture Diagram Accents

Used to colour-code the two layers in solution architecture diagrams.

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--color-arch-ui` | `#6366F1` | `#818CF8` | Client / UI layer (indigo) |
| `--color-arch-ui-soft` | `rgba(99,102,241,0.08)` | `rgba(129,140,248,0.10)` | UI layer tinted background |
| `--color-arch-engine` | `#10B981` | `#34D399` | Engine / backend layer (green) |
| `--color-arch-engine-soft` | `rgba(16,185,129,0.08)` | `rgba(52,211,153,0.10)` | Engine layer tinted background |
| `--color-arch-security` | `#EF4444` | `#F87171` | Security boundary (red) |
| `--color-arch-security-soft` | `rgba(239,68,68,0.06)` | `rgba(248,113,113,0.08)` | Security boundary tinted background |

---

## 3. Typography

**Font stack:** `'Inter', system-ui, -apple-system, sans-serif`
- Anti-aliasing: `-webkit-font-smoothing: antialiased`
- Inter is the preferred font; load from Google Fonts or bundle locally.

| Element | Size | Weight | Colour token |
|---|---|---|---|
| Page heading (H1) | `text-4xl` / `text-5xl` (responsive) | `font-extrabold` (800) | `--color-text-primary` with accent span |
| Section heading (H2) | `text-2xl` | `font-bold` (700) | `--color-text-primary` |
| Card heading (H3) | `text-lg` | `font-bold` (700) | `--color-text-primary` |
| Sub-heading (H4) | `text-sm` | `font-bold` (700) | `--color-text-primary` |
| Body / description | `text-sm` | `font-normal` (400) | `--color-text-secondary` |
| Caption / meta | `text-xs` or `text-[11px]` | `font-medium` (500) | `--color-text-secondary` |
| Version badge | `text-[10px]` | `font-mono` | `--color-accent` on `--color-accent-soft` background |
| Section label (all-caps) | `text-[10px]` | `font-bold`, `tracking-widest` | `--color-text-secondary` |

---

## 4. Spacing & Layout

- **Max content width:** `max-w-7xl` (80rem / 1280px), centred with `mx-auto`
- **Horizontal padding:** `px-4` → `sm:px-6` → `lg:px-8` (responsive)
- **Page top padding:** `pt-12`, bottom `pb-16`
- **Section spacing:** `mb-16` between major page sections
- **Card grid:** `grid-cols-1` → `sm:grid-cols-2` → `lg:grid-cols-3`, gap `gap-6`
- **Card border-radius:** `rounded-2xl` (16px) for cards; `rounded-xl` (12px) for inner components
- **Card padding:** `p-5` (cards), `p-6` or `p-8` (detail sections)

---

## 5. Component Patterns

### 5.1 Cards (Tool / Developer)

```
rounded-2xl
border: 1px solid --color-border
background: --color-bg-card
shadow: --color-card-shadow

:hover
  border-color: --color-border-hover
  background: --color-bg-card-hover
  shadow: --color-card-shadow-hover
  transform: scale(1.03) translateY(-4px)
  transition: all 300ms ease-out
```

- **Accent top border** on feature/architecture cards: `border-top: 4px solid --color-accent`
- **Accent left border** on security/detail cards: `border-left: 4px solid --color-accent`

### 5.2 Pill / Tag Badges

```
padding: px-2 py-0.5
border-radius: rounded-md (6px)
font-size: text-[11px]
font-weight: font-medium

Primary:   bg --color-pill-bg,     text --color-pill-text
Secondary: bg --color-pill-bg-alt, text --color-pill-text-alt
```

### 5.3 Icons

- All icons are **monochrome SVG** using `currentColor`
- Wrapped in a container with `color: var(--color-accent)` so they automatically switch between purple (light) and neon green (dark)
- Style: Heroicons outline style, `stroke-width: 1.5`, `24×24` viewBox
- **Never use emoji** as icons — always SVG with currentColor

### 5.4 Navigation Bar

```
position: sticky, top: 0, z-index: 50
height: 64px (h-16)
background: --color-nav-bg  (semi-transparent)
backdrop-filter: blur(24px) (backdrop-blur-xl)
border-bottom: 1px solid --color-border

Nav links: text-sm, font-medium, color --color-text-secondary
Nav links :hover: color --color-accent
```

### 5.5 Buttons

**Primary (CTA):**
```
background: --color-accent
color: white (light) / black (dark)
padding: px-5 py-2.5
border-radius: rounded-lg
font-weight: font-semibold
:hover background: --color-accent-hover
```

**Secondary / Ghost:**
```
border: 1px solid --color-border
color: --color-text-secondary
:hover border-color: --color-accent, color: --color-accent
```

**Disabled / Coming Soon:**
```
opacity: 0.4
cursor: not-allowed
```

### 5.6 Section Heading with Icon

Headings for major page sections include a leading accent-coloured SVG icon:
```html
<h2>
  <svg class="text-[--color-accent]" .../>  <!-- 24×24 icon -->
  Section Title
</h2>
```

### 5.7 Smooth Theme Transitions

Apply this globally so all theme changes animate smoothly:
```css
* {
  transition: background-color 0.2s ease,
              color 0.2s ease,
              border-color 0.2s ease,
              box-shadow 0.2s ease;
}
```

---

## 6. Architecture Diagram Pattern

The two-zone architecture layout uses a three-column grid: `[1fr] [60px] [1fr]`.

- **Left zone** (Client / UI Layer): `border-top: 4px solid --color-arch-ui`
- **Right zone** (Engine Layer): `border-top: 4px solid --color-arch-engine`
- **Centre bridge (desktop):** An SVG showing two animated horizontal channels:
  - Top arrow (left → right): `--color-arch-ui`, labelled `postMessage`
  - Bottom arrow (right → left): `--color-arch-engine`, labelled `event data`
  - Animated dot on each channel using SVG `<animateMotion>`, 0.9s phase offset
  - Centre badge: `IPC` text in a rounded rect
- **Centre bridge (mobile):** Vertical variant — top-to-bottom and bottom-to-top arrows side by side

Component blocks inside each zone use a tinted background matching the zone colour (use the `*-soft` token) when highlighted, and `--color-bg-secondary` for default blocks.

---

## 7. Full CSS Token Reference

Paste this into your project's root stylesheet:

```css
:root {
  /* Backgrounds */
  --color-bg-primary:      #FFFFFF;
  --color-bg-secondary:    #F9FAFB;
  --color-bg-card:         #FFFFFF;
  --color-bg-card-hover:   #F3EEFF;

  /* Text */
  --color-text-primary:    #1A1A2E;
  --color-text-secondary:  #6B7280;

  /* Accent */
  --color-accent:          #7C3AED;
  --color-accent-hover:    #6D28D9;
  --color-accent-soft:     rgba(124, 58, 237, 0.10);

  /* CTA */
  --color-cta:             #EC4899;
  --color-cta-hover:       #DB2777;

  /* Borders */
  --color-border:          #E5E7EB;
  --color-border-hover:    #7C3AED;

  /* Shadows */
  --color-card-shadow:       0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --color-card-shadow-hover: 0 10px 40px rgba(124,58,237,0.15), 0 4px 12px rgba(124,58,237,0.10);
  --color-glow:              rgba(124, 58, 237, 0.30);

  /* Pills */
  --color-pill-bg:         #EDE9FE;
  --color-pill-text:       #6D28D9;
  --color-pill-bg-alt:     #FCE7F3;
  --color-pill-text-alt:   #BE185D;

  /* Navigation */
  --color-nav-bg:          rgba(255, 255, 255, 0.85);

  /* Feature card accents */
  --color-feature-health:    #F59E0B;
  --color-feature-rules:     #10B981;
  --color-feature-clash:     #EF4444;
  --color-feature-analytics: #6366F1;
  --color-feature-security:  #10B981;

  /* Architecture diagram */
  --color-arch-ui:            #6366F1;
  --color-arch-ui-soft:       rgba(99, 102, 241, 0.08);
  --color-arch-engine:        #10B981;
  --color-arch-engine-soft:   rgba(16, 185, 129, 0.08);
  --color-arch-security:      #EF4444;
  --color-arch-security-soft: rgba(239, 68, 68, 0.06);
}

.dark {
  /* Backgrounds */
  --color-bg-primary:      #0A0A0A;
  --color-bg-secondary:    #111111;
  --color-bg-card:         #161616;
  --color-bg-card-hover:   #1E1E1E;

  /* Text */
  --color-text-primary:    #F5F5F5;
  --color-text-secondary:  #9CA3AF;

  /* Accent */
  --color-accent:          #CCFF00;
  --color-accent-hover:    #B8E600;
  --color-accent-soft:     rgba(204, 255, 0, 0.08);

  /* CTA */
  --color-cta:             #CCFF00;
  --color-cta-hover:       #B8E600;

  /* Borders */
  --color-border:          #262626;
  --color-border-hover:    #CCFF00;

  /* Shadows */
  --color-card-shadow:       0 1px 3px rgba(0,0,0,0.30);
  --color-card-shadow-hover: 0 10px 40px rgba(204,255,0,0.08), 0 4px 12px rgba(204,255,0,0.05);
  --color-glow:              rgba(204, 255, 0, 0.25);

  /* Pills */
  --color-pill-bg:         rgba(204, 255, 0, 0.10);
  --color-pill-text:       #CCFF00;
  --color-pill-bg-alt:     rgba(204, 255, 0, 0.06);
  --color-pill-text-alt:   #A3CC00;

  /* Navigation */
  --color-nav-bg:          rgba(10, 10, 10, 0.85);

  /* Feature card accents */
  --color-feature-health:    #FBBF24;
  --color-feature-rules:     #34D399;
  --color-feature-clash:     #F87171;
  --color-feature-analytics: #818CF8;
  --color-feature-security:  #34D399;

  /* Architecture diagram */
  --color-arch-ui:            #818CF8;
  --color-arch-ui-soft:       rgba(129, 140, 248, 0.10);
  --color-arch-engine:        #34D399;
  --color-arch-engine-soft:   rgba(52, 211, 153, 0.10);
  --color-arch-security:      #F87171;
  --color-arch-security-soft: rgba(248, 113, 113, 0.08);
}

/* Global theme transition */
* {
  transition: background-color 0.2s ease,
              color 0.2s ease,
              border-color 0.2s ease,
              box-shadow 0.2s ease;
}

body {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

---

## 8. Dos and Don'ts

| Do | Don't |
|---|---|
| Use CSS custom properties for every colour | Hardcode hex values in components |
| Use `currentColor` on all SVG icons | Use emoji as icons |
| Apply accent colour to interactive elements | Use multiple competing accent colours |
| Keep copy factual and understated | Use marketing superlatives or enterprise jargon |
| Show `.dark` class on `<html>` for theme switching | Use `prefers-color-scheme` media queries alone |
| Tint card shadows with the accent colour | Use black/grey shadows in dark mode |
| Use `backdrop-blur` on the nav | Use a fully opaque nav background |
