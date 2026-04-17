# New Tool — Content Requirements Guide

This document tells you exactly what content to gather and provide so that a new tool can be added to the Design Automation Hub portal. Every field maps directly to a specific part of the portal UI. Nothing is cosmetic — if a field is listed here, it appears somewhere visible on the page.

Work through each section in order. Where a field is marked **Required**, the tool cannot be added without it. Where it is marked **Optional**, the portal will gracefully hide that element if not provided.

---

## Section 1 — Tool Identity

These fields appear in the tool card on the main page and in the hero banner on the tool detail page.

| Field | Required | Notes |
|---|---|---|
| **Tool name** | Required | The full display name. E.g. `Revit Active Quality Monitor`, `Multi-D Co-ordination Analytics` |
| **Tagline** | Required | One sentence (under 80 characters). Shown beneath the name in the hero. Focus on the core value proposition. |
| **Short description** | Required | 2–3 sentences. Shown on the tool card and in the page meta description. Should answer: what does it do, for whom, and what is the key benefit. |
| **Platform(s)** | Required | The software the tool runs inside. E.g. `Revit`, `Navisworks Manage`, `Navisworks Simulate`, `AutoCAD`. List all that apply. |
| **Discipline(s)** | Required | The AEC disciplines this tool serves. E.g. `Architecture`, `Structure`, `MEP`, `QA`, `Coordination`, `Clash Detection`, `Analytics`. List all that apply. |
| **Icon type** | Required | Choose one of the following named icons that best represents the tool. This becomes a monochrome SVG on the card, coloured in the theme accent (purple / neon green):<br>`dashboard` — bar chart / KPI panels<br>`coordination` — grid / matrix<br>`rules` — checklist / compliance<br>`clash` — intersecting shapes<br>`analytics` — line chart<br>`automation` — cog / workflow<br>`model` — 3D cube<br>If none fit, describe what the icon should convey and a new one will be created. |
| **Version** | Optional | The current release version string, e.g. `1.0.0`. If a GitHub repo is provided (see Section 3), the live release tag will override this automatically at build time. |
| **Display order** | Required | Integer. Controls position in the tool grid. Existing tools: Revit Quality Monitor = `1`, Multi-D Co-ordination Analytics = `2`. Set `3` for the next tool. |

---

## Section 2 — Wording Guidelines

Before writing any copy, note the following rules that apply across all tool content on this portal:

- **Tone:** Factual and understated. Avoid marketing superlatives.
- **Avoid:** "scalable", "mission-critical", "enterprise-grade", "cutting-edge", "game-changing", "digital transformation", "board-ready".
- **Do not** imply the tool is intended for healthcare, defense, or government use cases.
- Use **"non-compliant"** rather than "offending" when referring to elements that fail checks.
- Air-gapped / offline wording should read: *"Designed for use in secure, offline project environments."*

---

## Section 3 — Source & Download Links

These appear as buttons in the hero banner. If not yet published, leave blank and the buttons will show as "Coming Soon".

| Field | Required | Notes |
|---|---|---|
| **GitHub URL** | Optional | Full URL to the repository. E.g. `https://github.com/owner/repo` |
| **GitHub Repo** | Optional | The `owner/repo` string only (no URL). E.g. `owner/repo`. Used to automatically fetch the latest release version badge at build time. |
| **Download URL** | Optional | Full URL to the releases page or a specific release asset. E.g. `https://github.com/owner/repo/releases` |

---

## Section 4 — Screenshots

Screenshots appear in two places:
1. **Tool card on the main page** — auto-cycling slideshow (one image every 3 seconds, crossfade)
2. **Carousel on the tool detail page** — shown as individual slides before the video, with thumbnail strip below

**Requirements:**
- Format: PNG or JPG
- Minimum 4 screenshots recommended; maximum is unrestricted
- Capture the tool in use — dashboards, results panels, dialogs. Avoid capturing menus or loading states.
- Provide a short caption per screenshot (used as the carousel slide label and image alt text)

**Provide:**
- The image files (or the folder path where they are saved)
- A caption for each image

**Caption format:**
```
Screenshot 1: <caption>
Screenshot 2: <caption>
...
```

---

## Section 5 — Video Walkthrough

The video appears as the final slide in the carousel on the tool detail page.

**Requirements:**
- Format: MP4
- A single combined walkthrough video is preferred over multiple separate clips
- Recommended length: 2–8 minutes
- No minimum resolution, but 1080p is preferred

**Provide:**
- The video file (or the folder path where it is saved)
- A caption for the video. Format: `"Full walkthrough — <topic 1>, <topic 2>, <topic 3>"`

---

## Section 6 — Key Features

This section populates the **Key Features** panel on the tool detail page. It is displayed as a **2×2 grid of feature cards**, each with a monochrome icon, a title, and 3 bullet points. A fifth card spanning the full width covers data security.

You need to provide content for **4 main feature cards** and **1 security card**.

### Feature Card Template

For each of the 4 main cards, provide:

```
Card [1–4]
  Title: <feature area name>
  Icon: <choose from: bar-chart, magnifying-glass, wrench, grid, lightning, 
         document-check, chart-line, cube, cog, shield, or describe the concept>
  
  Bullet 1
    Label: <short bold label, 2–5 words>
    Description: <1–2 sentences explaining this capability in plain language>
  
  Bullet 2
    Label: <short bold label>
    Description: <1–2 sentences>
  
  Bullet 3
    Label: <short bold label>
    Description: <1–2 sentences>
```

### Security Card Template (full-width, spans bottom)

```
Security Card
  Title: <e.g. "Data Security & Local Processing">
  
  Point 1
    Label: <e.g. "Local-Only Processing">
    Description: <How data stays on the machine — what is never transmitted>
  
  Point 2
    Label: <e.g. "Read-Only Engine">
    Description: <What the tool never modifies — geometry, parameters, model state, etc.>
  
  Point 3
    Label: <e.g. "Air-Gapped Ready">
    Description: <Offline / no-internet operation statement. Use the standard wording: 
    "No data ever leaves your machine. Designed for use in secure, offline project environments." 
    — adjust only if technically inaccurate for this tool.>
```

---

## Section 7 — Solution Architecture

This section populates the **Solution Architecture** diagram on the tool detail page. The diagram shows two zones (Client Layer and Engine Layer) connected by an animated IPC bridge, followed by three perspective cards.

### 7.1 Client Layer (left zone)

The client layer is the UI that the user interacts with — typically a panel, dockable window, WebView2 dashboard, or WPF dialog.

**Provide:**

```
Client Layer
  Technology label: <e.g. "WebView2", "WPF", "Revit Panel", "WinForms">
  
  Component 1 (highlighted — the most important UI element)
    Title: <e.g. "Dashboard Shell">
    Description: <1–2 sentences on what this UI element does and how the user interacts with it>
  
  Component 2
    Title: <e.g. "Chart Rendering Engine">
    Description: <1–2 sentences>
  
  Component 3
    Title: <e.g. "Filter & State Engine">
    Description: <1–2 sentences>
  
  (Optional) Component 4
    Title: ...
    Description: ...
```

### 7.2 Engine Layer (right zone)

The engine layer is the backend code — typically C# plugin logic, API wrappers, data processors.

**Provide:**

```
Engine Layer
  Technology label: <e.g. "C# / .NET 4.8", "C# / .NET 6", "Python">
  
  Component 1 (highlighted — the most critical backend element)
    Title: <e.g. "API Handler">
    Description: <1–2 sentences on what this component does internally>
  
  Component 2
    Title: ...
    Description: ...
  
  Component 3 (security boundary — if applicable)
    Title: <e.g. "Security & Data Isolation">
    Description: <How data is kept local and the model is protected from write operations>
  
  (Optional) Component 4
    Title: ...
    Description: ...
```

### 7.3 IPC Bridge

The animated connector between the two layers.

```
Bridge label: <e.g. "Async IPC", "Event Queue", "REST", "Named Pipe">
Forward channel label:  <what goes client → engine, e.g. "command", "request", "postMessage">
Return channel label:   <what goes engine → client, e.g. "data", "response", "event data">
```

### 7.4 Perspective Cards (3 audience viewpoints)

Three small cards below the diagram, each written for a different audience. Tailor the job titles to the tool's actual users.

```
Card 1
  Audience: <e.g. "For BIM Managers", "For BIM Coordinators">
  Text: <2–3 sentences on how this person benefits from the tool in practice. 
         Focus on workflow improvement, not features.>

Card 2
  Audience: <e.g. "For Technology Leads">
  Text: <2–3 sentences on the architectural or technical value — 
         decoupling, extensibility, API compatibility, version safety, etc.>

Card 3
  Audience: <e.g. "For Project Managers", "For Project Directors">
  Text: <2–3 sentences on project-level benefit — 
         coordination efficiency, reporting, cost/risk reduction. 
         Do NOT say data is available without opening the host application 
         unless that is literally true.>
```

---

## Section 8 — Checklist Summary

Use this checklist to confirm everything has been gathered before handing off to the developer agent.

### Identity
- [ ] Tool name
- [ ] Tagline (≤ 80 characters)
- [ ] Short description (2–3 sentences)
- [ ] Platform(s)
- [ ] Discipline(s)
- [ ] Icon type (named or described)
- [ ] Display order number

### Links
- [ ] GitHub repository URL (or confirm not yet published)
- [ ] GitHub repo string `owner/repo` (for live version badge)
- [ ] Download URL (or confirm not yet published)

### Media
- [ ] Minimum 4 screenshots with captions
- [ ] 1 combined MP4 walkthrough video with caption

### Key Features
- [ ] Feature Card 1 (title + icon + 3 bullets)
- [ ] Feature Card 2 (title + icon + 3 bullets)
- [ ] Feature Card 3 (title + icon + 3 bullets)
- [ ] Feature Card 4 (title + icon + 3 bullets)
- [ ] Security Card (title + 3 points)

### Solution Architecture
- [ ] Client Layer: technology label + 3–4 component blocks
- [ ] Engine Layer: technology label + 3–4 component blocks
- [ ] IPC bridge labels (bridge name, forward channel, return channel)
- [ ] Perspective Card 1 (audience + 2–3 sentences)
- [ ] Perspective Card 2 (audience + 2–3 sentences)
- [ ] Perspective Card 3 (audience + 2–3 sentences)

---

## Section 9 — File Delivery Format

When handing this content off to the developer agent, provide:

1. **This file filled in** with all text content
2. **Screenshot files** — provide the folder path, e.g. `C:\Work\MyTool\Images\`
3. **Video file** — provide the full file path, e.g. `C:\Work\MyTool\walkthrough.mp4`

The developer agent will handle all file copying, code generation, and deployment automatically.
