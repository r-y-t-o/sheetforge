# ACC Sheet Generator — Developer Handoff Document

## 1. Project Overview

The **ACC Sheet Generator** is a web application that automates the extraction of Revit sheet PDFs from Autodesk Construction Cloud (ACC). Users browse their ACC project tree, select a Revit model, trigger a server-side PDF export, and then either download the resulting individual PDF sheets locally or upload them back to a different ACC folder.

**Project Root:** `c:\_Work\ACC PDF Generator\server\`

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js | Server-side JavaScript |
| Framework | Express.js `^4.18.2` | HTTP routing, middleware, static file serving |
| Session | cookie-session `^2.0.0` | Encrypted session cookies storing the APS access token |
| HTTP Client | axios `^1.6.0` | All outbound calls to Autodesk APIs |
| ZIP Processing | adm-zip `^0.5.16` | In-memory extraction of exported ZIP archives |
| Environment | dotenv `^16.3.1` | `.env` file loading for local development |
| Dev Tooling | nodemon `^3.0.1` | Auto-restart on file changes during development |
| Front End | Vanilla HTML/CSS/JS | No build step, no framework |
| Hosting | Azure App Service | Production deployment (with Easy Auth + Key Vault) |

---

## 3. File Structure

```
server/
├── server.js              # THE backend — all Express routes in a single file
├── package.json           # Dependencies and npm scripts
├── .env                   # Local environment variables (gitignored)
├── .env.example           # Template for required env vars
└── public/                # Static assets served by Express
    ├── index.html         # Single-page HTML shell (login + app screens)
    ├── app.js             # All client-side logic (auth, tree, export workflow)
    ├── style.css          # Complete stylesheet (~960 lines, glassmorphism design)
    └── images/
        └── logo.png       # Company logo
```

> [!IMPORTANT]
> This is a **single-file backend** architecture. All routes, middleware, and business logic live in `server.js` (615 lines). There is no router splitting, no controllers directory, and no models layer. If you plan to extend the project significantly, consider refactoring into modular route files.

---

## 4. Environment Variables

Defined in `.env` (locally) or Azure App Service Configuration / Key Vault (production):

| Variable | Description |
|----------|-------------|
| `APS_CLIENT_ID` | Autodesk Platform Services OAuth Client ID |
| `APS_CLIENT_SECRET` | Autodesk Platform Services OAuth Client Secret |
| `APS_CALLBACK_URL` | OAuth redirect URI (e.g. `https://your-app.azurewebsites.net/auth/callback`) |
| `SESSION_SECRET` | Random string used to encrypt the `cookie-session` |
| `PORT` | Server port (defaults to `8080` if unset) |

---

## 5. Authentication Flow

The app supports **two login methods**. Both result in an Autodesk APS access token being stored in the session cookie.

### 5a. Autodesk OAuth (3-Legged) — Primary

```
Browser                       server.js                        Autodesk
  │                              │                                │
  ├──GET /auth/login────────────>│                                │
  │                              ├──302 redirect────────────────->│
  │<─────────────────────────────┤  (to APS /authorize)           │
  │                              │                                │
  │  User logs in on Autodesk    │                                │
  │                              │                                │
  │<─────────────────────────────┤<──GET /auth/callback?code=──── │
  │                              │                                │
  │                              ├──POST /token (exchange code)──>│
  │                              │<──access_token, refresh_token──│
  │                              │                                │
  │                              │  Store tokens in session cookie│
  │<──302 redirect to /──────────│                                │
```

**Key code:** [server.js lines 47-79](file:///c:/_Work/ACC%20PDF%20Generator/server/server.js#L47-L79)

- OAuth scopes requested: `data:read data:write data:create`
- Session stores: `access_token`, `refresh_token`, `expires_at`, `login_method`

### 5b. Token Login — Manual / Development

Users can paste a pre-generated access token directly. The server stores it in the session identically to the OAuth flow.

**Key code:** [server.js lines 82-96](file:///c:/_Work/ACC%20PDF%20Generator/server/server.js#L82-L96)

- Endpoint: `POST /auth/token-login` with `{ "access_token": "..." }`
- Token is assumed to expire in 1 hour

### 5c. Auth Middleware

Every `/api/*` route is protected by `authMiddleware` which checks for `req.session.access_token`:

```javascript
const authMiddleware = (req, res, next) => {
    if (!req.session.access_token) {
        return res.status(401).json({ error: 'Unauthorized. Please login.' });
    }
    next();
};
```

---

## 6. API Routes Reference

### Authentication Routes

| Method | Path | Auth? | Description |
|--------|------|-------|-------------|
| `GET` | `/auth/login` | No | Redirects to Autodesk OAuth consent screen |
| `GET` | `/auth/callback` | No | Handles OAuth code exchange, sets session |
| `POST` | `/auth/token-login` | No | Accepts `{ access_token }`, sets session |
| `GET` | `/api/auth/status` | No | Returns `{ authenticated, login_method, expires_at }` |
| `GET` | `/auth/logout` | No | Clears session, redirects to `/` |

### Data Management Routes (proxies to Autodesk Data Management API)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/hubs` | List all ACC hubs the user has access to |
| `GET` | `/api/hubs/:hubId/projects` | List projects within a hub |
| `GET` | `/api/hubs/:hubId/projects/:projectId/topFolders` | List root folders of a project |
| `GET` | `/api/projects/:projectId/folders/:folderId/contents` | List folder contents (files + subfolders) |
| `GET` | `/api/projects/:projectId/items/:itemId/versions` | List versions of a file item |

### Export & Processing Routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/export/trigger` | Triggers PDF export job on Autodesk |
| `GET` | `/api/export/:projectId/:exportId` | Polls export job status |
| `POST` | `/api/export/extract` | Downloads ZIP, extracts files in-memory, caches them |
| `GET` | `/api/export/file/:exportId/:fileId` | Serves a single extracted file from cache |
| `POST` | `/api/export/download` | Proxies the original ZIP download to the browser |
| `POST` | `/api/export/upload-files` | Uploads selected extracted files to an ACC folder |
| `POST` | `/api/export/transfer` | Legacy: uploads the entire ZIP as-is to ACC |

---

## 7. The PDF Export Pipeline (Core Feature)

This is the most important workflow in the application. It spans both front end and back end across multiple asynchronous steps.

### Step-by-step sequence:

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  FRONT END  │     │   BACK END   │     │   AUTODESK     │
│  (app.js)   │     │  (server.js) │     │   CLOUD        │
└──────┬──────┘     └──────┬───────┘     └───────┬────────┘
       │                   │                     │
  ① User clicks           │                     │
    "Export PDF"           │                     │
       │                   │                     │
       ├──POST /api/export/trigger──>│           │
       │   { projectId,    │                     │
       │     versionUrns } │                     │
       │                   ├──POST /construction/files/v1/─>│
       │                   │  projects/{id}/exports         │
       │                   │  { fileVersions: [...] }       │
       │                   │<──{ id: exportId }─────────────│
       │<──{ id }──────────│                     │
       │                   │                     │
  ② Front end polls        │                     │
    every 5 seconds        │                     │
       │                   │                     │
       ├──GET /api/export/{projectId}/{exportId}>│
       │                   ├──GET  /construction/files/v1/─>│
       │                   │  projects/{id}/exports/{expId} │
       │                   │<──{ status, signedUrl }────────│
       │<──{ status }──────│                     │
       │                   │                     │
       │  (repeat until    │                     │
       │   status =        │                     │
       │   "successful")   │                     │
       │                   │                     │
  ③ Export complete,       │                     │
    extract files          │                     │
       │                   │                     │
       ├──POST /api/export/extract──>│           │
       │  { sourceDownloadUrl,       │           │
       │    exportId }     │                     │
       │                   ├──GET signedUrl (download ZIP)─>│
       │                   │<──ZIP binary data──────────────│
       │                   │                     │
       │                   │  [adm-zip extracts  │
       │                   │   entries in memory]│
       │                   │                     │
       │                   │  [cache files in    │
       │                   │   extractedFilesCache Map]     │
       │                   │                     │
       │<──{ files: [{id, name,                  │
       │     size, isPdf}], exportId }           │
       │                   │                     │
  ④ User selects files     │                     │
    and downloads or       │                     │
    uploads to ACC         │                     │
       │                   │                     │
```

### 7a. Export Trigger

**Front end** ([app.js:369-376](file:///c:/_Work/ACC%20PDF%20Generator/server/public/app.js#L369-L376)):
```javascript
// Sends the project ID and version URN(s) to the backend
const triggerRes = await fetch('/api/export/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        projectId: state.selectedSource.projectId,
        versionUrns: [state.selectedSource.versionUrn]
    })
});
```

**Back end** ([server.js:191-224](file:///c:/_Work/ACC%20PDF%20Generator/server/server.js#L191-L224)):
- Strips the `b.` prefix from the project ID (Autodesk's Construction Files API does not use the `b.` prefix that the Data Management API uses)
- Calls `POST /construction/files/v1/projects/{projectId}/exports` with `{ fileVersions: [...] }`
- Returns the `exportId` to the front end

> [!NOTE]
> **Project ID Gotcha:** The Data Management API uses project IDs prefixed with `b.` (e.g., `b.abc123`), but the Construction Files API requires the raw ID (`abc123`). The backend strips this prefix with: `projectId.startsWith('b.') ? projectId.substring(2) : projectId`

### 7b. Polling

**Front end** ([app.js:389-414](file:///c:/_Work/ACC%20PDF%20Generator/server/public/app.js#L389-L414)):
- Polls `GET /api/export/{projectId}/{exportId}` every 5 seconds
- Maximum 120 attempts (10 minutes timeout)
- Accepts terminal statuses: `successful`, `completed`, `success`, `partialsuccess`
- Fails on status: `failed`

**Back end** ([server.js:227-244](file:///c:/_Work/ACC%20PDF%20Generator/server/server.js#L227-L244)):
- Proxies to `GET /construction/files/v1/projects/{projectId}/exports/{exportId}`
- Returns the full Autodesk response including `status` and `result.output.signedUrl`

### 7c. ZIP Extraction (The Core Processing Step)

**Back end** ([server.js:249-312](file:///c:/_Work/ACC%20PDF%20Generator/server/server.js#L249-L312)):

This is where the actual PDF isolation happens:

1. **Download:** The server downloads the ZIP from Autodesk's signed URL into a `Buffer` (in memory, NOT to disk)
2. **Extract:** Uses `adm-zip` to parse the ZIP entries
3. **Catalog:** For each entry:
   - Generates a unique `fileId` by base64url-encoding the entry path
   - Reads the file data into a `Buffer`
   - Flags whether it's a PDF based on extension
4. **Cache:** Stores all file buffers in an in-memory `Map` keyed by `exportId`
5. **TTL:** Schedules automatic cleanup after 1 hour via `setTimeout`

```javascript
// The in-memory cache structure
const extractedFilesCache = new Map();
// Key:   exportId (string)
// Value: {
//   files: Map<fileId, { name, buffer, size, isPdf }>,
//   createdAt: timestamp
// }
```

> [!WARNING]
> **Memory consideration:** The entire ZIP and all extracted file buffers are held in Node.js process memory. For very large Revit exports (many sheets), this could consume significant RAM. The cache auto-clears after 1 hour, but concurrent large exports could be problematic. A future improvement would be to use Azure Blob Storage or temp files instead.

### 7d. File Download

**Back end** ([server.js:315-338](file:///c:/_Work/ACC%20PDF%20Generator/server/server.js#L315-L338)):
- Looks up the file buffer from the in-memory cache
- Sets appropriate `Content-Type` (`application/pdf` or `application/octet-stream`)
- Sends the buffer directly as the response

### 7e. Upload to ACC (5-Step Process)

**Back end** ([server.js:362-492](file:///c:/_Work/ACC%20PDF%20Generator/server/server.js#L362-L492)):

Uploading a file to ACC is a multi-step process using the Autodesk Data Management + OSS APIs:

```
Step 1: POST /data/v1/projects/{id}/storage
        → Create a storage reservation, get an objectId

Step 2: GET /oss/v2/buckets/{bucket}/objects/{name}/signeds3upload
        → Get a pre-signed S3 upload URL

Step 3: PUT {s3-signed-url}
        → Upload the file binary to S3

Step 4: POST /oss/v2/buckets/{bucket}/objects/{name}/signeds3upload
        → Finalize the upload with the uploadKey

Step 5: POST /data/v1/projects/{id}/items
        → Create the item record in ACC linking to the uploaded storage object
```

Each file is uploaded sequentially. Results are aggregated and returned as:
```json
{ "results": [...], "successCount": 3, "totalCount": 5 }
```

---

## 8. Front End Architecture

The front end is a vanilla JS single-page application with two screens toggled via CSS classes.

### 8a. State Management

All application state lives in a single global object ([app.js:1-7](file:///c:/_Work/ACC%20PDF%20Generator/server/public/app.js#L1-L7)):

```javascript
const state = {
    selectedSource: null,    // { projectId, itemId, versionUrn, name }
    selectedTarget: null,    // { projectId, folderId, name }
    exportMode: 'cloud',     // 'cloud' or 'local'
    extractedFiles: null,    // { files: [...], exportId }
};
```

### 8b. Screen Toggling

- **Login Screen** (`#login-screen`): Shown by default, hidden when authenticated
- **App Screen** (`#app-screen`): Shown after successful auth check

The toggle uses CSS class `.active` on `.screen` elements.

### 8c. Tree Navigation

The tree component is built entirely in JavaScript using DOM manipulation. It renders a recursive tree structure for browsing ACC data:

```
Hub → Project → Folder → Subfolder/File
```

**Key functions:**

| Function | Purpose |
|----------|---------|
| `loadHubs(treeId)` | Fetches hubs and renders root nodes |
| `createTreeNode({...})` | Creates a single tree node DOM element with expand/collapse |
| `loadChildren(container, parentType, parentId, treeId, projectId)` | Lazy-loads children on expand |
| `findHubId(el)` | Walks up the DOM tree to find the parent hub ID |

**Tree filtering logic** ([app.js:256-259](file:///c:/_Work/ACC%20PDF%20Generator/server/public/app.js#L256-L259)):
- **Source tree:** Only shows folders and `.rvt` files
- **Target tree:** Only shows folders (for selecting upload destination)

### 8d. Version URN Resolution

When the user selects a `.rvt` file in the source tree, the version URN is extracted from the `included` array of the folder contents response (this is JSON:API sideloading):

```javascript
// app.js:294-297
const version = included.find(v => v.relationships?.item?.data?.id === itemId);
if (version) versionUrn = version.id;
```

> [!IMPORTANT]
> The `versionUrn` is critical for the export trigger. It comes from the `included` data in the folder contents API response, NOT from a separate versions API call. If this data is missing, the export will fail.

---

## 9. Autodesk APIs Used

| API | Base URL | Purpose |
|-----|----------|---------|
| Authentication v2 | `https://developer.api.autodesk.com/authentication/v2` | OAuth token exchange |
| Data Management v1 | `https://developer.api.autodesk.com/project/v1` | Hubs, projects, top folders |
| Data Management v1 | `https://developer.api.autodesk.com/data/v1` | Folder contents, item versions, storage, items |
| Construction Files v1 | `https://developer.api.autodesk.com/construction/files/v1` | PDF export trigger & status polling |
| Object Storage Service v2 | `https://developer.api.autodesk.com/oss/v2` | Signed S3 upload URLs for file uploads |

---

## 10. Azure Deployment Details

### Infrastructure

- **Azure App Service** hosts the Node.js Express server
- **Azure App Service Authentication (Easy Auth)** enforces Microsoft Entra ID SSO before requests reach the app
- **Azure Key Vault** stores `APS_CLIENT_ID`, `APS_CLIENT_SECRET`, and `SESSION_SECRET`
- **System-Assigned Managed Identity** connects App Service to Key Vault (no credentials needed)

### Configuration

- `trust proxy` is set to `1` on Express to handle Azure's SSL termination at the load balancer
- Session cookies use `secure: true` and `sameSite: 'lax'`
- The app listens on HTTP (Azure terminates SSL at the load balancer)
- `PORT` defaults to `8080` if not provided by Azure

---

## 11. Running Locally

```bash
cd c:\_Work\ACC PDF Generator\server
cp .env.example .env        # Fill in your APS credentials
npm install
npm run dev                  # Starts with nodemon on port 8080
```

> [!NOTE]
> For local development with `secure: true` cookies, you may need to either set `secure: false` temporarily or use HTTPS locally. The token login method (`/auth/token-login`) bypasses the OAuth redirect and works without HTTPS.

---

## 12. Known Limitations & Future Improvement Areas

| Area | Current State | Improvement |
|------|--------------|-------------|
| **In-memory cache** | ZIP files held in Node.js heap | Use Azure Blob Storage or temp disk |
| **Single-file backend** | All 615 lines in `server.js` | Split into route modules |
| **No token refresh** | Token expires after ~1 hour, user must re-login | Implement automatic refresh using `refresh_token` |
| **Sequential uploads** | Files uploaded to ACC one at a time | Parallelize with concurrency limit |
| **No error retry** | Failed API calls are not retried | Add retry with exponential backoff |
| **No test suite** | No automated tests | Add integration tests for export pipeline |
| **Source tree filters** | Only `.rvt` files shown | Could support other exportable formats |
