import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { z } from "zod";
import { normalizeHost } from "../src/lib/host.ts";

export { normalizeHost };

/** User-Agent used upstream: many XC panels reject browser UAs. */
const UPSTREAM_UA = "VLC/3.0.21 LibVLC/3.0.21";
const API_TIMEOUT_MS = 30_000;

/** Origins the stream proxy is allowed to reach (filled by logins and playlist rewrites). */
const allowedOrigins = new Set<string>();

export function allowOrigin(rawUrl: string): void {
  allowedOrigins.add(new URL(rawUrl).origin);
}

export function isOriginAllowed(rawUrl: string): boolean {
  return allowedOrigins.has(new URL(rawUrl).origin);
}

const ApiRequest = z.object({
  host: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  action: z.string().regex(/^[a-z_]+$/).optional(),
  params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > 64 * 1024) throw new Error("request body too large");
    chunks.push(buf);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

/** POST /api/xc  — forwards a player_api.php call and returns its JSON. */
export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") return sendJson(res, 405, { error: "method not allowed" });

  const parsed = ApiRequest.safeParse(await readJsonBody(req));
  if (!parsed.success) return sendJson(res, 400, { error: "invalid request", issues: parsed.error.issues });

  const { username, password, action, params } = parsed.data;
  let host: string;
  try {
    host = normalizeHost(parsed.data.host);
  } catch (err) {
    console.warn("[api] invalid host", parsed.data.host, err);
    return sendJson(res, 400, { error: "invalid host url" });
  }

  const target = new URL(`${host}/player_api.php`);
  target.searchParams.set("username", username);
  target.searchParams.set("password", password);
  if (action) target.searchParams.set("action", action);
  for (const [k, v] of Object.entries(params ?? {})) target.searchParams.set(k, String(v));

  const request = () =>
    fetch(target, {
      headers: { "user-agent": UPSTREAM_UA, accept: "application/json" },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
  let upstream: Response;
  try {
    upstream = await request().catch((err: unknown) => {
      console.warn(`[api] first attempt failed host=${host} action=${action ?? "auth"}, retrying`, err);
      return request();
    });
  } catch (err) {
    console.error(`[api] upstream unreachable host=${host} action=${action ?? "auth"}`, err);
    return sendJson(res, 502, { error: "servidor XC inacessível" });
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    console.warn(`[api] upstream ${upstream.status} host=${host} action=${action ?? "auth"}`);
    return sendJson(res, 502, { error: `servidor XC respondeu ${upstream.status}` });
  }

  let json: unknown;
  try {
    json = text.trim() === "" ? null : JSON.parse(text);
  } catch (err) {
    console.warn(`[api] non-JSON response host=${host} action=${action ?? "auth"}`, err);
    return sendJson(res, 502, { error: "resposta inválida do servidor XC" });
  }

  allowOrigin(host);
  allowOrigin(upstream.url);
  sendJson(res, 200, json);
}

const URI_ATTR = /URI="([^"]+)"/g;

function proxify(ref: string, base: string): string {
  const abs = new URL(ref, base).toString();
  allowOrigin(abs);
  return `/stream?url=${encodeURIComponent(abs)}`;
}

/** Rewrites every URI in an HLS playlist so it goes through /stream. */
export function rewritePlaylist(body: string, baseUrl: string): string {
  return body
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim();
      if (t === "") return line;
      if (t.startsWith("#")) return line.replace(URI_ATTR, (_m, uri: string) => `URI="${proxify(uri, baseUrl)}"`);
      return proxify(t, baseUrl);
    })
    .join("\n");
}

function isPlaylist(contentType: string, url: string): boolean {
  return /mpegurl/i.test(contentType) || /\.m3u8(\?|$)/i.test(url);
}

const PASS_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"];

/** GET /stream?url=...  — media proxy with Range support and HLS rewriting. */
export async function handleStream(req: IncomingMessage, res: ServerResponse, reqUrl: URL): Promise<void> {
  const raw = reqUrl.searchParams.get("url");
  if (!raw) return sendJson(res, 400, { error: "missing url" });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return sendJson(res, 400, { error: "invalid url" });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") return sendJson(res, 400, { error: "unsupported protocol" });
  if (!isOriginAllowed(target.toString())) return sendJson(res, 403, { error: "origin not allowed — faça login primeiro" });

  const controller = new AbortController();
  res.on("close", () => controller.abort());

  const headers: Record<string, string> = { "user-agent": UPSTREAM_UA };
  if (req.headers.range) headers.range = req.headers.range;

  // XC panels redirect to CDN edges that intermittently time out on connect: retry once before giving up.
  const request = () => fetch(target, { headers, signal: controller.signal, redirect: "follow" });
  let upstream: Response;
  try {
    upstream = await request().catch((err: unknown) => {
      if (controller.signal.aborted) throw err;
      console.warn(`[stream] retrying ${target.origin} after`, err instanceof Error ? (err.cause ?? err.message) : err);
      return request();
    });
  } catch (err) {
    if (controller.signal.aborted) return;
    // Path holds the user's credentials (/movie/<user>/<pass>/id): log only origin and file.
    console.error(`[stream] upstream unreachable ${target.origin}/…/${target.pathname.split("/").pop() ?? ""}`, err);
    return sendJson(res, 502, { error: "stream inacessível" });
  }

  allowOrigin(upstream.url);
  const contentType = upstream.headers.get("content-type") ?? "";

  if (upstream.ok && isPlaylist(contentType, upstream.url)) {
    const body = rewritePlaylist(await upstream.text(), upstream.url);
    res.writeHead(200, { "content-type": "application/vnd.apple.mpegurl", "cache-control": "no-store" });
    res.end(body);
    return;
  }

  const out: Record<string, string> = { "cache-control": "no-store" };
  for (const h of PASS_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) out[h] = v;
  }
  res.writeHead(upstream.status, out);
  if (!upstream.body) return void res.end();

  const nodeStream = Readable.fromWeb(upstream.body as import("node:stream/web").ReadableStream<Uint8Array>);
  nodeStream.on("error", (err) => {
    if (controller.signal.aborted) return;
    console.error(`[stream] pipe error ${target.origin}/…/${target.pathname.split("/").pop() ?? ""}`, err);
    res.destroy(err);
  });
  nodeStream.pipe(res);
}
