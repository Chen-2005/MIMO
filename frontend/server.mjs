import { createServer } from "https";
import { request } from "http";
import { readFileSync } from "fs";
import next from "next";

const port = 3000;
const hostname = "0.0.0.0";
const apiBackend = "http://127.0.0.1:8000";

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: readFileSync("./key.pem"),
  cert: readFileSync("./cert.pem"),
};

function proxyToBackend(req, res) {
  const url = new URL(req.url, apiBackend);
  const proxyReq = request(
    {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: req.method,
      headers: {
        ...req.headers,
        host: url.host,
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on("error", (err) => {
    console.error("Proxy error:", err.message);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ code: 502, message: "Backend unavailable" }));
  });
  req.pipe(proxyReq);
}

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    if (req.url.startsWith("/api/") || req.url.startsWith("/static/")) {
      proxyToBackend(req, res);
    } else {
      handle(req, res);
    }
  }).listen(port, hostname, () => {
    console.log(`> HTTPS ready on https://${hostname}:${port}`);
    console.log(`> API proxied to ${apiBackend}`);
  });
});
