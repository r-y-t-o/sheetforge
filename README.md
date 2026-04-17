# SheetForge

Web app that exports Revit sheets from Autodesk Construction Cloud (ACC) as PDFs and renames them using a user-defined combination of title-block and sheet parameters. Runs locally in a browser; Node/Express backend, vanilla JS frontend, no build step.

## Features

- Sign in with Autodesk (3-legged OAuth) or paste an APS access token.
- Browse ACC hubs → projects → folders, pick a Revit `.rvt` version.
- Read sheet and title-block parameters via the APS **Model Derivative API** (translates the model to SVF2 and reads the property database).
- Build a filename pattern by picking parameters as chips, drag to reorder, set a separator.
- Live preview for the first five sheets.
- Trigger the ACC **Construction Files Export** to produce sheet PDFs.
- Deliver the renamed PDFs by either:
  - Uploading to a chosen ACC folder (5-step Data Management + OSS upload).
  - Downloading everything as a single ZIP.
  - Or both.

## Prerequisites

- Node.js 18+ and npm.
- An **APS (Autodesk Platform Services) app** registered at https://aps.autodesk.com/myapps with:
  - `Autodesk Construction Cloud` API access.
  - `Data Management`, `Model Derivative` API access.
  - Callback URL set to `http://localhost:8080/auth/callback` (or your deploy URL).
- An ACC project that your Autodesk account has access to, containing a `.rvt` file.

## Getting started (local)

```bash
git clone <this repo>
cd SheetForge/server
cp .env.example .env
# open .env and paste your APS_CLIENT_ID, APS_CLIENT_SECRET, SESSION_SECRET
npm install
npm run dev
```

Open http://localhost:8080, sign in with Autodesk, and you should see your ACC hubs.

## Environment variables

| Name | Required | Description |
|------|----------|-------------|
| `APS_CLIENT_ID` | yes | OAuth client ID from APS developer portal |
| `APS_CLIENT_SECRET` | yes | OAuth client secret |
| `APS_CALLBACK_URL` | yes | Matches the callback URL registered on the APS app |
| `SESSION_SECRET` | yes | Long random string used to sign the session cookie |
| `PORT` | no | Defaults to `8080` |
| `NODE_ENV` | no | Set to `production` behind a TLS-terminating proxy to enable secure cookies |

## How filename renaming works

1. When you pick a Revit version, the app sends the version URN to the Model Derivative API, requesting (or reusing) an SVF2 translation. The first run on a given version takes longer because the translation has to complete.
2. Once the derivative is ready, the server reads the properties endpoint, filters objects whose category is `Revit Sheets`, and flattens their parameters under `Sheet.<name>`. Title-block family-instance parameters hosted by each sheet are attached under `TitleBlock.<name>`.
3. The UI shows the union of all parameter keys as draggable chips. You pick and order the ones you want in the filename and set a separator (default `" - "`).
4. When you run the export, the server triggers the ACC Construction Files export in parallel with the naming pipeline, extracts the resulting PDFs in memory, matches each PDF to a sheet by its sheet number, and renames accordingly.
5. Filenames are sanitized (Windows-reserved characters stripped, reserved device names like `CON` escaped, trailing dots/spaces trimmed, collisions deduped with `-1`, `-2`).

## Repository layout

```
server/
  src/
    index.js                app assembly
    config.js               env loading + validation
    middleware/             auth guard + error handler
    routes/                 auth / data / metadata / export / upload
    services/               apsClient, derivativeService, exportService,
                            namingService, uploadService
public/
  index.html                single-page shell
  css/style.css
  js/                       api, tree, naming, app
```

All state is per-session. The extracted-PDF cache is in-memory with a 1-hour TTL; restart the server to clear it manually.

## Deployment notes

The app is a standard Node/Express process — any host that runs Node works.

- **Azure App Service:** set `NODE_ENV=production`, configure the env vars under *Configuration* or link to a Key Vault, point the startup command at `node server/src/index.js`. The trust-proxy is already set to `1`.
- **Fly.io / Render / Railway / Docker:** expose `PORT`, copy in the repo, run `npm install --prefix server`, then `npm start --prefix server`.
- **Callback URL** must match whatever host you deploy to (e.g. `https://yourapp.example.com/auth/callback`) and be registered on the APS app.

## Known limitations

- In-memory cache for extracted PDFs — large exports consume RAM; restart if you run into memory pressure.
- Sheet ↔ PDF matching relies on the sheet number appearing in the PDF filename. If your Revit export template produces unusual names, adjust `matchFilesToSheets` in `server/src/services/namingService.js`.
- Title-block host detection is best-effort across Revit property-database shapes. If your file produces empty `TitleBlock.*` entries, inspect the raw `/api/metadata/sheets` response in the browser devtools and extend `flattenSheetParameters` in `derivativeService.js`.
- Only 3-legged OAuth / user-delegated access is supported. For server-to-server workflows (2-legged), add a separate route.

## License

MIT — see [LICENSE](LICENSE).
