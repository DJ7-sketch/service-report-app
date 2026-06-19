# GitHub Pages deployment

This project uses a static GitHub Pages frontend, a Render-hosted Node API, and Supabase Postgres for production data.

## Production URLs

- Frontend: `https://dj7-sketch.github.io/service-report-app/`
- Render API: `https://service-report-api.onrender.com`
- GitHub repository: `https://github.com/DJ7-sketch/service-report-app`

## Frontend configuration

`config.js` must point to the Render API:

```js
window.SERVICE_REPORT_API_BASE = "https://service-report-api.onrender.com";
```

GitHub Pages serves only static files. It cannot run `server.js`; all shared login and report storage must go through the Render API.

## Render configuration

Create or update the Render Web Service:

- Name: `service-report-api`
- Runtime: `Node`
- Build Command: `npm install`
- Start Command: `node server.js`

Required environment variables:

```text
DATABASE_URL=<Supabase Postgres connection string>
CORS_ORIGIN=https://dj7-sketch.github.io
PASSWORD_DONGHYEOK=<real password>
PASSWORD_SANGMIN=<real password>
PASSWORD_MINHYUK=<real password>
PASSWORD_ADMIN=<real password>
```

The checked-in `render.yaml` includes these keys. Secret values are marked with `sync: false` and must be entered in Render.

## Supabase Postgres

`server.js` connects to Supabase through `DATABASE_URL` and automatically creates the `service_reports` table if it does not exist.

The API health endpoint should return `storage: "postgres"` when production persistence is configured:

```text
https://service-report-api.onrender.com/api/health
```

## GitHub Pages settings

In the GitHub repository:

1. Open `Settings` > `Pages`.
2. Select the branch or GitHub Actions workflow used for this static site.
3. Confirm the published URL is `https://dj7-sketch.github.io/service-report-app/`.

## Default passwords

These defaults exist only for local testing. Set real passwords in Render before real use.

| User | Default password | Environment variable |
| --- | --- | --- |
| Donghyeok Jung | `DJ2026!` | `PASSWORD_DONGHYEOK` |
| Sangmin Lee | `SL2026!` | `PASSWORD_SANGMIN` |
| Minhyuk Lee | `ML2026!` | `PASSWORD_MINHYUK` |
| Service Manager | `admin2026!` | `PASSWORD_ADMIN` |
