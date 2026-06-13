const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "reports.json");
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
  fs.writeFileSync(DB_FILE, `${JSON.stringify(reports, null, 2)}\n`, "utf8");
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
      sendJson(res, 200, { ok: true, storage: "json-file" });
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
      sendJson(res, 200, readReports());
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
      writeReports(body.reports);
      sendJson(res, 200, { ok: true, count: body.reports.length });
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
