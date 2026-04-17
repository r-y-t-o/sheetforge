# SheetForge — Portal Content

Filled-in version of `new-tool-content-guide.md` for the Design Automation Hub portal.

---

## Section 1 — Tool Identity

| Field | Value |
|---|---|
| **Tool name** | SheetForge |
| **Tagline** | Export Revit sheets from ACC as PDFs renamed by your chosen parameters. *(70 chars)* |
| **Short description** | SheetForge exports every sheet of a Revit model in Autodesk Construction Cloud as an individual PDF and renames each file from a user-defined combination of sheet and title-block parameters. A browser-based step-by-step flow lets BIM teams produce consistent, audit-ready PDF sets in one pass, then upload the renamed files back to an ACC folder or download them as a ZIP. |
| **Platform(s)** | Revit · Forma |
| **Discipline(s)** | BIM Management · Documentation · QA |
| **Icon type** | **New icon — please create.** Should convey the four themes together: *automation*, *sheets*, *print*, *PDF*. Suggested composition: a stylised sheet/page outline with a small "PDF" or printer glyph in a corner, combined with a cog or arrow loop to signal automation. Monochrome, rendered in the theme accent on the card. |
| **Version** | `0.2.0` *(from `server/package.json`)* |
| **Display order** | `3` |

> **Note on platform field:** SheetForge does not run *inside* Revit or Forma — it is a standalone web app that reads Revit models published to Autodesk Construction Cloud and produces renamed PDF sets. Tagging it under **Revit** (as the source authoring tool) and **Forma** (as the wider Autodesk design platform) reflects the user audience, which is the intended discovery signal.

---

## Section 3 — Source & Download Links

| Field | Value |
|---|---|
| **GitHub URL** | `https://github.com/r-y-t-o/sheetforge` |
| **GitHub Repo** | `r-y-t-o/sheetforge` |
| **Download URL** | `https://github.com/r-y-t-o/sheetforge` *(clone and run — there is no pre-built binary; the README covers `npm install` + APS app setup)* |

---

## Section 4 — Screenshots

*You will provide the image files. Suggested set of five, each with a caption below — adjust the captions to whatever your actual captures show.*

```
Screenshot 1: Source — browsing ACC hubs, projects and folders to pick a Revit version.
Screenshot 2: Parameters — selecting the sheet and title-block parameters to include in the filename.
Screenshot 3: Arrange — drag-and-drop ordering of selected parameters with hyphen and underscore separators, live preview of the first five filenames.
Screenshot 4: Export — progress panel showing the ACC Construction Files export and PDF extraction.
Screenshot 5: Deliver — choosing between upload to an ACC folder or download as a ZIP, with a final file list and status per sheet.
```

Expected folder path for delivery: `C:\_Work\SheetPDFConverter\portal-media\screenshots\`

---

## Section 5 — Video Walkthrough

*You will record the video. Suggested caption:*

```
Full walkthrough — connecting to ACC, choosing sheet and title-block parameters,
arranging the filename pattern, and delivering renamed PDFs back to ACC or as a ZIP.
```

Expected file path for delivery: `C:\_Work\SheetPDFConverter\portal-media\sheetforge-walkthrough.mp4`

---

## Section 6 — Key Features

### Card 1 — Parameter-driven renaming

```
Title: Parameter-driven renaming
Icon:  document-check

Bullet 1
  Label: Sheet and title-block parameters
  Description: Reads every instance parameter on each ViewSheet and walks nested
  title-block family instances, so both sheet fields (Sheet Number, Current
  Revision, …) and title-block fields (Project Number, Drawn By, …) are available.

Bullet 2
  Label: Filename pattern builder
  Description: Pick any subset of parameters, then drag them into the order you
  want. Insert hyphen or underscore separators between fields. Empty values fall
  back to a configurable placeholder.

Bullet 3
  Label: Safe, deduplicated filenames
  Description: Sanitises characters that are invalid on Windows and appends
  numeric suffixes if two sheets collapse to the same filename, so no PDF is
  silently overwritten.
```

### Card 2 — Autodesk Construction Cloud integration

```
Title: Autodesk Construction Cloud integration
Icon:  cog

Bullet 1
  Label: 3-legged OAuth sign-in
  Description: Users sign in with their own Autodesk account and only see the
  hubs, projects and folders they already have access to in ACC. No service
  accounts, no shared credentials.

Bullet 2
  Label: Hub and project browsing
  Description: Navigate hubs → projects → folders → Revit items → versions in
  a live tree, and pick the exact version of the model to export from.

Bullet 3
  Label: Write-back to ACC
  Description: Renamed PDFs can be uploaded as new items into any destination
  folder the user selects in ACC, using the standard 5-step storage + signed
  S3 upload pipeline.
```

### Card 3 — Metadata extraction

```
Title: Metadata extraction
Icon:  magnifying-glass

Bullet 1
  Label: Model Derivative pipeline
  Description: Triggers an SVF2 translation of the chosen version, polls the
  manifest to completion, then pulls the full object-tree and property set for
  the sheet model view.

Bullet 2
  Label: Title-block flattening
  Description: Walks nested family instances under each sheet and flattens
  their parameters into the sheet record, so both namespaces appear as
  selectable fields in one list.

Bullet 3
  Label: Per-version caching
  Description: Translated metadata is cached in memory per model version for
  the duration of the session, so repeated exports from the same model do not
  re-run the translation job.
```

### Card 4 — Batch export and delivery

```
Title: Batch export and delivery
Icon:  lightning

Bullet 1
  Label: Construction Files Export API
  Description: Uses the ACC Construction Files Export API to generate the full
  PDF set server-side, then streams the ZIP into memory and splits it into
  per-sheet PDFs indexed by sheet number.

Bullet 2
  Label: Parallel upload with retry
  Description: Uploads to ACC run four in parallel with keep-alive sockets and
  automatic retry on transient network errors. Long runs are protected by a
  30-minute server-side request timeout.

Bullet 3
  Label: ZIP alternative
  Description: If write-back is not wanted, the entire renamed set can instead
  be streamed as a single ZIP download — useful for offline review or
  submission packages.
```

### Security Card (full-width, spans bottom)

```
Security Card
  Title: Data Handling and Access Boundaries

  Point 1
    Label: Self-hosted, session-scoped
    Description: SheetForge runs on infrastructure the user controls. Autodesk
    access tokens are kept only in an encrypted, HttpOnly, SameSite session
    cookie and are cleared on logout — no tokens, PDFs or metadata are written
    to disk by the server.

  Point 2
    Label: Autodesk-only network egress
    Description: The server talks to no third-party services. Every outbound
    call goes to developer.api.autodesk.com or to an Autodesk-signed S3 URL for
    export downloads and uploads; outbound requests to other hosts are blocked
    by an allow-list.

  Point 3
    Label: Read-by-default on the source model
    Description: The tool never modifies the source Revit model or any item in
    its folder. Write operations are confined to creating new PDF items in a
    destination folder that the user explicitly chooses in the final step.
```

> **Note:** The guide's suggested "air-gapped / no data leaves your machine" wording is **not** accurate for SheetForge, because it is by design a client to Autodesk cloud services. I have replaced Point 3 with an honest read-only statement about the source model instead.

---

## Section 7 — Solution Architecture

### 7.1 Client Layer (left zone)

```
Client Layer
  Technology label: Browser SPA (vanilla JS, no build step)

  Component 1 (highlighted)
    Title: Step Flow Orchestrator
    Description: Drives the four-step UI — Source, Parameters, Arrange,
    Deliver — and keeps a single state object in sync with the server as the
    user progresses.

  Component 2
    Title: ACC Tree Browser
    Description: Lazy-loaded hub → project → folder → item → version tree.
    Resolves the version URN on demand using the Data Management API's
    included-resource sideload.

  Component 3
    Title: Naming Builder
    Description: Two-phase UI. First, toggle-selectable parameter chips grouped
    by namespace. Second, an HTML5 drag-and-drop row where selected fields are
    reordered and hyphen / underscore tiles are dragged in from a side tray.
    Live-renders the filename for the first five sheets.

  Component 4
    Title: Delivery Panel
    Description: Shows per-sheet upload or ZIP-build progress with a status
    badge per file, and surfaces any per-sheet errors without aborting the
    batch.
```

### 7.2 Engine Layer (right zone)

```
Engine Layer
  Technology label: Node.js 18+ / Express

  Component 1 (highlighted)
    Title: APS Client
    Description: A single axios-based HTTP client with keep-alive sockets,
    automatic refresh-token rotation, and transparent exponential-backoff
    retry on transient transport and 5xx errors.

  Component 2
    Title: Metadata Service
    Description: Drives the Model Derivative translation, manifest polling,
    metadata GUID lookup and property extraction, then flattens nested
    title-block instances into per-sheet parameter records.

  Component 3
    Title: Export & Upload Pipeline
    Description: Wraps the ACC Construction Files Export, streams the
    resulting ZIP into an in-memory cache keyed by export ID, then performs
    the 5-step OSS upload (storage → signed S3 PUT → finalize → item create)
    with p-limit concurrency of four.

  Component 4 (security boundary)
    Title: Session & Request Security
    Description: Hardened Express stack — Content-Security-Policy, HSTS,
    SameSite=Lax session cookies, same-origin CSRF guard, per-route rate
    limiting, outbound-host allow-list on the download proxy, and input
    validators on every route parameter.
```

### 7.3 IPC Bridge

```
Bridge label:           HTTPS / JSON REST
Forward channel label:  fetch request
Return channel label:   JSON response
```

### 7.4 Perspective Cards

```
Card 1
  Audience: For BIM Managers
  Text: Standardises issued PDF filenames across every project in one pass,
  driven by the project's own sheet and title-block parameters rather than by
  a separate naming spreadsheet. Issue sets that used to be renamed by hand or
  by ad-hoc scripts can be produced and re-uploaded to ACC in the same step.

Card 2
  Audience: For Technology Leads
  Text: A single, self-hosted codebase with no build step on the client and
  only Autodesk APIs on the back end. The OAuth flow, retry transport and
  upload pipeline are all encapsulated in small services, so adding new
  pattern logic, alternative delivery targets, or a different metadata source
  does not touch the UI or the auth layer.

Card 3
  Audience: For Document Controllers
  Text: Removes the manual rename step between "export from Revit" and "issue
  to consultants". The generated filenames are deterministic from the model's
  own parameters, so issues produced from the same model always collate the
  same way — and collisions are flagged and deduplicated rather than silently
  overwritten.
```

---

## Section 8 — Checklist

### Identity
- [x] Tool name — SheetForge
- [x] Tagline
- [x] Short description
- [x] Platform(s) — Revit · Forma
- [x] Discipline(s)
- [x] Icon type — new icon requested (themes: automation, sheets, print, PDF)
- [x] Display order — 3

### Links
- [x] GitHub repository URL
- [x] GitHub repo string
- [x] Download URL — *same as repo; no pre-built binary*

### Media
- [ ] Screenshots — **you will provide** (captions drafted above)
- [ ] Walkthrough video — **you will provide** (caption drafted above)

### Key Features
- [x] Feature Card 1 — Parameter-driven renaming
- [x] Feature Card 2 — ACC integration
- [x] Feature Card 3 — Metadata extraction
- [x] Feature Card 4 — Batch export and delivery
- [x] Security Card — *rewrote Point 3; see note*

### Solution Architecture
- [x] Client Layer (4 components)
- [x] Engine Layer (4 components)
- [x] IPC bridge labels
- [x] Perspective Card 1 — BIM Managers
- [x] Perspective Card 2 — Technology Leads
- [x] Perspective Card 3 — Document Controllers

---

## What I cannot create — please supply

1. **Screenshots** — at least 4, captions drafted above (`portal-content.md` Section 4).
2. **Walkthrough video** — single MP4, caption drafted above (Section 5).
3. **New icon artwork** — a monochrome SVG expressing *automation + sheets + print + PDF* together (described in Section 1).
