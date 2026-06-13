const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "reports.json");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
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
  });
  res.end(body);
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
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/api/health") {
      sendJson(res, 200, { ok: true, storage: "json-file" });
      return;
    }
    if (req.url === "/api/reports" && req.method === "GET") {
      sendJson(res, 200, readReports());
      return;
    }
    if (req.url === "/api/reports" && req.method === "PUT") {
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
