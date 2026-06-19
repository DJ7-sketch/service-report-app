# Data persistence setup: Render API + Supabase Postgres

The service report app must use the shared API server for all report saves.
Do not rely on browser local storage for production records.

## Production URLs

- Frontend: `https://dj7-sketch.github.io/service-report-app/`
- API: `https://service-report-api.onrender.com`
- Repository: `https://github.com/DJ7-sketch/service-report-app`

## Required Render environment variables

Set these on the Render Web Service named `service-report-api`:

```text
DATABASE_URL=<Supabase Postgres connection string>
CORS_ORIGIN=https://dj7-sketch.github.io
PASSWORD_DONGHYEOK=<real password>
PASSWORD_SANGMIN=<real password>
PASSWORD_MINHYUK=<real password>
PASSWORD_ADMIN=<real password>
```

`server.js` uses `DATABASE_URL` to connect through the `pg` package. On startup, it creates this table if needed:

```sql
create table if not exists service_reports (
  id text primary key,
  report jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## Supabase connection string

Use the Supabase Project Settings database connection string. A pooled connection string is usually better for hosted services.

If the password contains special characters, use the exact URL-encoded connection string Supabase provides.

## Fallback behavior

If `DATABASE_URL` is missing, the API falls back to local JSON storage at `data/reports.json`.
That fallback is useful for local testing only. Render's filesystem is ephemeral, so production must use Supabase Postgres.

If the frontend cannot reach the API, report saving is blocked instead of silently saving production records to one browser.
