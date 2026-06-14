# Data persistence setup

The service report app must use the shared API server for all report saves.
Do not rely on browser local storage for production records.

## Why reports can disappear

Render Web Services use an ephemeral filesystem by default. If reports are saved
to `data/reports.json` inside the deployed app, those records can be lost after a
redeploy or restart.

## Required Render setting

Add a Render Persistent Disk to the `service-report-api` Web Service.

- Mount path: `/var/data`
- Environment variable: `REPORT_DATA_DIR=/var/data`

After this is configured, the API stores reports at:

```text
/var/data/reports.json
```

The app also keeps one previous-copy backup at:

```text
/var/data/reports-backup.json
```

## Important

If `Shared server DB` is not connected, the app now blocks report saving instead
of silently saving only to one browser/device.
