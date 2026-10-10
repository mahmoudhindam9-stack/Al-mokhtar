const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "dist");
const host = "127.0.0.1";
const port = Number(process.env.PORT || 3000);
const mimeTypes = {
  ".css": "text/css; charset=utf-8", ".gif": "image/gif", ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon", ".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8", ".webp": "image/webp", ".woff": "font/woff", ".woff2": "font/woff2"
};
if (!fs.existsSync(path.join(root, "index.html"))) {
  console.error("Al-Mokhtar: dist/index.html is missing. Build the application before launching.");
  process.exit(1);
}
const server = http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }); response.end("Method not allowed"); return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname); }
  catch { response.writeHead(400); response.end("Bad request"); return; }
  if (pathname.startsWith("/api/")) {
    response.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "هذه الخدمة تحتاج اتصالًا بالخادم وليست متاحة في وضع الملفات الثابتة." })); return;
  }
  const requested = path.resolve(root, "." + pathname);
  if (requested !== root && !requested.startsWith(root + path.sep)) { response.writeHead(403); response.end("Forbidden"); return; }
  let filePath = requested;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, "index.html");
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) filePath = path.join(root, "index.html");
  response.writeHead(200, {
    "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "Cache-Control": path.basename(filePath) === "index.html" ? "no-store" : "public, max-age=3600",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer"
  });
  if (request.method === "HEAD") { response.end(); return; }
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => { if (!response.headersSent) response.writeHead(500); response.end("Unable to read file"); });
  stream.pipe(response);
});
server.listen(port, host, () => console.log(`Al-Mokhtar is running locally at http://${host}:${port}`));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
