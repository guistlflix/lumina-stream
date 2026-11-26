import { setDefaultResultOrder } from "node:dns";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { handleApi, handleStream } from "./proxy.ts";
import { handleMock } from "./mock.ts";

// Many XC hosts sit behind Cloudflare with AAAA records; broken IPv6 routes caused intermittent connect timeouts.
setDefaultResultOrder("ipv4first");

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";
const PROD = process.argv.includes("--prod");
const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", HOST.toLowerCase()]);
const DIST = resolve(import.meta.dirname, "../dist");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

async function serveStatic(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
  let file = join(DIST, rel);
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  const info = await stat(file).catch(() => null);
  if (!info || info.isDirectory()) file = join(DIST, "index.html");
  const body = await readFile(file);
  const cache = file.includes(`${join(DIST, "assets")}`) ? "public, max-age=31536000, immutable" : "no-cache";
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream", "cache-control": cache });
  res.end(req.method === "HEAD" ? undefined : body);
}

async function main(): Promise<void> {
  let viteMiddleware: Middleware | null = null;
  if (!PROD) {
    const { createServer: createVite } = await import("vite");
    const vite = await createVite({ server: { middlewareMode: true }, appType: "spa" });
    viteMiddleware = vite.middlewares as unknown as Middleware;
  }

  const server = createServer((req, res) => {
    // DNS-rebinding guard: a hostile domain resolving to 127.0.0.1 still sends its own name in Host.
    const hostName = (req.headers.host ?? "").replace(/:\d+$/, "").toLowerCase();
    if (!ALLOWED_HOSTS.has(hostName)) {
      console.warn(`[server] rejected request with host "${hostName}"`);
      res.writeHead(403, { "content-type": "text/plain" }).end("forbidden host");
      return;
    }
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `${HOST}:${PORT}`}`);
    const route = async (): Promise<void> => {
      if (url.pathname === "/api/xc") return handleApi(req, res);
      if (url.pathname === "/stream") return handleStream(req, res, url);
      if (url.pathname.startsWith("/mock/")) return handleMock(req, res, url);
      if (viteMiddleware) {
        viteMiddleware(req, res, () => res.writeHead(404).end());
        return;
      }
      return serveStatic(req, res, url);
    };
    route().catch((err: unknown) => {
      console.error(`[server] ${req.method} ${url.pathname} failed`, err);
      if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "internal error" }));
    });
  });

  server.listen(PORT, HOST, () => {
    console.log(`Lumina Stream ${PROD ? "(prod)" : "(dev)"} → http://${HOST}:${PORT}`);
    console.log(`Demo XC: host http://${HOST}:${PORT}/mock  user demo  pass demo`);
  });
}

main().catch((err: unknown) => {
  console.error("[server] failed to start", err);
  process.exit(1);
});
