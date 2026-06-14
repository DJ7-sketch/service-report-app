const http = require("http");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = process.env.REPORT_DATA_DIR || process.env.DATA_DIR || path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "reports.json");
const BACKUP_FILE = path.join(DATA_DIR, "reports-backup.json");
const DATABASE_URL = process.env.DATABASE_URL || "";
const pgPool = DATABASE_URL ? new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
}) : null;
let postgresReady = false;
const sessions = new Map();
const users = {
  "engineer-donghyeok": {
    name: "Donghyeok Jung",
    role: "engineer",
    password: process.env.PASSWORD_DONGHYEOK || "DJ2026!",
  },
  "engineer-sangmin": {
    name: "Sangmin Lee",
    role: "engineer",
    password: process.env.PASSWORD_SANGMIN || "SL2026!",
  },
  "engineer-minhyuk": {
    name: "Minhyuk Lee",
    role: "engineer",
    password: process.env.PASSWORD_MINHYUK || "ML2026!",
  },
  admin: {
    name: "Service Manager",
    role: "admin",
    password: process.env.PASSWORD_ADMIN || "admin2026!",
  },
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".pdf": "application/pdf",
  ".json": "application/json; charset=utf-8",
};

function ensureDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]\n", "utf8");
}

function readReports() {
  ensureDb();
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeReports(reports) {
  ensureDb();
  if (fs.existsSync(DB_FILE)) fs.copyFileSync(DB_FILE, BACKUP_FILE);
  const tempFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tempFile, `${JSON.stringify(reports, null, 2)}\n`, "utf8");
  fs.renameSync(tempFile, DB_FILE);
}

async function ensurePostgres() {
  if (!pgPool || postgresReady) return;
  await pgPool.query(`
    create table if not exists service_reports (
      id text primary key,
      report jsonb not null,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `);
  await pgPool.query(`
    create index if not exists service_reports_updated_at_idx
    on service_reports (updated_at desc)
  `);
  postgresReady = true;
}

async function readStoredReports() {
  if (!pgPool) return readReports();
  await ensurePostgres();
  const result = await pgPool.query("select report from service_reports order by updated_at desc");
  return result.rows.map((row) => row.report);
}

async function replaceStoredReports(reports) {
  if (!pgPool) {
    writeReports(reports);
    return reports.length;
  }
  await ensurePostgres();
  const client = await pgPool.connect();
  try {
    await client.query("begin");
    await client.query("delete from service_reports");
    for (const report of reports) {
      if (!report || !report.id) continue;
      await client.query(
        `insert into service_reports (id, report, created_at, updated_at)
         values ($1, $2::jsonb, coalesce($3::timestamptz, now()), coalesce($4::timestamptz, now()))`,
        [report.id, JSON.stringify(report), report.createdAt || null, report.updatedAt || report.createdAt || null],
      );
    }
    await client.query("commit");
    return reports.length;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function upsertStoredReports(reports) {
  if (!pgPool) {
    const mergedById = new Map(readReports().map((report) => [report.id, report]));
    reports.forEach((report) => {
      if (report && report.id) mergedById.set(report.id, report);
    });
    const mergedReports = Array.from(mergedById.values()).sort((a, b) => {
      return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
    });
    writeReports(mergedReports);
    return mergedReports.length;
  }
  await ensurePostgres();
  const client = await pgPool.connect();
  try {
    await client.query("begin");
    for (const report of reports) {
      if (!report || !report.id) continue;
      await client.query(
        `insert into service_reports (id, report, created_at, updated_at)
         values ($1, $2::jsonb, coalesce($3::timestamptz, now()), coalesce($4::timestamptz, now()))
         on conflict (id) do update set report = excluded.report, updated_at = excluded.updated_at`,
        [report.id, JSON.stringify(report), report.createdAt || null, report.updatedAt || report.createdAt || null],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  const result = await pgPool.query("select count(*)::int as count from service_reports");
  return result.rows[0].count;
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  });
  res.end(body);
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 25 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const requestPath = decodeURIComponent(url.pathname.slice(1)) || "index.html";
  const filePath = path.resolve(ROOT, requestPath);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": contentTypes[ext] || "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=300",
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
  });
  fs.createReadStream(filePath).pipe(res);
}

function tokenFor(userKey) {
  return Buffer.from(`${userKey}:${Date.now()}:${Math.random()}`).toString("base64url");
}

function requireUser(req, res) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const user = sessions.get(token);
  if (!user) {
    sendJson(res, 401, { error: "Unauthorized" });
    return null;
  }
  return user;
}

const server = http.createServer(async (req, res) => {
  try {
    setCors(res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.url === "/api/health") {
      if (pgPool) await ensurePostgres();
      sendJson(res, 200, { ok: true, storage: pgPool ? "postgres" : "json-file", dataDir: pgPool ? null : DATA_DIR });
      return;
    }
    if (req.url === "/api/login" && req.method === "POST") {
      const body = JSON.parse(await readBody(req) || "{}");
      const user = users[body.userKey];
      if (!user || user.password !== body.password) {
        sendJson(res, 401, { error: "Invalid credentials" });
        return;
      }
      const token = tokenFor(body.userKey);
      sessions.set(token, { key: body.userKey, name: user.name, role: user.role });
      sendJson(res, 200, { token, user: { key: body.userKey, name: user.name, role: user.role } });
      return;
    }
    if (req.url === "/api/reports" && req.method === "GET") {
      const user = requireUser(req, res);
      if (!user) return;
      sendJson(res, 200, await readStoredReports());
      return;
    }
    if (req.url === "/api/reports" && req.method === "PUT") {
      const user = requireUser(req, res);
      if (!user) return;
      const body = JSON.parse(await readBody(req) || "{}");
      if (!Array.isArray(body.reports)) {
        sendJson(res, 400, { error: "reports must be an array" });
        return;
      }
      if (body.mode === "replace") {
        const count = await replaceStoredReports(body.reports);
        sendJson(res, 200, { ok: true, count, mode: "replace", storage: pgPool ? "postgres" : "json-file" });
        return;
      }
      const count = await upsertStoredReports(body.reports);
      sendJson(res, 200, { ok: true, count, mode: "merge", storage: pgPool ? "postgres" : "json-file" });
      return;
    }
    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, HOST, () => {
  const interfaces = require("os").networkInterfaces();
  const addresses = Object.values(interfaces)
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => `http://${item.address}:${PORT}/`);
  console.log(`Service Report server running at http://localhost:${PORT}/`);
  if (addresses.length) console.log(`LAN URLs:\n${addresses.join("\n")}`);
});
