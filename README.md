# Service Report Web App

Responsive web app for creating, managing, sharing, and printing LivaNova-style service reports.

## Run

Production frontend:

`https://dj7-sketch.github.io/service-report-app/`

Production API:

`https://service-report-api.onrender.com`

Repository:

`https://github.com/DJ7-sketch/service-report-app`

For local frontend testing, open `index.html` in a browser. It reads the API URL from `config.js`.

For GitHub Pages deployment, see `GITHUB_PAGES_SETUP.md`.

For multiple employees, run the shared server:

```bash
node server.js
```

Then open:

`http://SERVER_IP:4173/`

The server prints LAN URLs when it starts. Other employees on the same network can use that URL.

In Codex preview, use:

`http://127.0.0.1:4173/`

## Main Features

- Engineer report creation with auto-save
- Password login for 3 engineers and admin
- Engineer selection: Donghyeok Jung, Sangmin Lee, Minhyuk Lee
- Report No. generation: `SR-YYYYMMDD-001`
- Status workflow: `draft`, `submitted`, `reviewed`, `completed`, `deleted`
- Uploaded LivaNova logo image in app header and A4 print view
- A4 portrait single-page compact report layout
- Working time rows with automatic Hrs/Mins and total calculation
- Parts used table
- Customer and FSE signature canvases
- Engineer report list
- Admin dashboard, all-report list, search/filter/sort, soft delete, restore, permanent delete
- Audit logs stored in each report record
- GitHub Pages frontend connected to the Render API through `config.js`
- Render API connected to Supabase Postgres through `DATABASE_URL`
- JSON-file storage is only a local fallback when `DATABASE_URL` is not set

## PDF/Print

Use the `PDF/Print` button. The print layout is designed as one A4 portrait page and hides all form controls.

## Storage

In production, reports are stored in Supabase Postgres. Render must provide:

`DATABASE_URL=<Supabase pooled or direct Postgres connection string>`

When `DATABASE_URL` is set, `server.js` automatically creates and uses the `service_reports` table.

If `DATABASE_URL` is not set, the server falls back to local JSON storage:

`data/reports.json`

Default login passwords are documented in `GITHUB_PAGES_SETUP.md`. Change them with environment variables before real use.

Draft auto-save remains browser-local. Production records should be saved through the Render API to Supabase Postgres.

## Windows Firewall

If other PCs cannot connect to `http://SERVER_IP:4173/`, allow inbound TCP traffic for port `4173` in Windows Firewall or deploy the folder to an internal web server.
