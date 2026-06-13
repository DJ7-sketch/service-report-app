# Service Report Web App

Responsive web app for creating, managing, sharing, and printing LivaNova-style service reports.

## Run

For single-user local testing, open `index.html` in a browser.

For GitHub Pages deployment, see:

`GITHUB_PAGES_SETUP.md`

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
- Shared JSON-file database when served by `server.js`
- GitHub Pages frontend can connect to a deployed API by setting `config.js`
- localStorage fallback when opened without the server

## PDF/Print

Use the `PDF/Print` button. The print layout is designed as one A4 portrait page and hides all form controls.

## Storage

When using `server.js`, reports are stored in:

`data/reports.json`

Default login passwords are documented in `GITHUB_PAGES_SETUP.md`. Change them with environment variables before real use.

Draft auto-save remains browser-local. This file-based server is suitable for small internal MVP use. For production, replace the JSON file repository with Supabase, Firebase, PostgreSQL, or an internal API, and add real authentication.

## Windows Firewall

If other PCs cannot connect to `http://SERVER_IP:4173/`, allow inbound TCP traffic for port `4173` in Windows Firewall or deploy the folder to an internal web server.
