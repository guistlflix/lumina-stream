import { z } from "zod";
import { normalizeHost } from "./host.ts";

/* ---------- lenient primitives: XC panels mix strings, numbers and nulls ---------- */

const str = z
  .union([z.string(), z.number(), z.boolean()])
  .nullish()
  .transform((v) => (v === null || v === undefined ? "" : String(v)));

const num = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  });

const strList = z
  .union([z.array(z.union([z.string(), z.null()])), z.string()])
  .nullish()
  .transform((v) => (Array.isArray(v) ? v.filter((x): x is string => !!x) : v ? [v] : []));

/* ---------- schemas ---------- */

const AuthSchema = z.object({
  user_info: z.object({
    auth: num,
    status: str,
    exp_date: str,
    max_connections: str,
    active_cons: str,
    allowed_output_formats: z.array(z.string()).nullish().transform((v) => v ?? []),
  }),
  server_info: z.object({ timezone: str }).partial().nullish(),
});

const CategorySchema = z.object({ category_id: str, category_name: str }).transform((c) => ({
  id: c.category_id,
  name: c.category_name.trim() || "Sem categoria",
}));

const LiveSchema = z
  .object({ stream_id: str, name: str, stream_icon: str, category_id: str, epg_channel_id: str, num })
  .transform((s) => ({ id: s.stream_id, name: s.name.trim(), icon: s.stream_icon, categoryId: s.category_id, num: s.num }));

const VodSchema = z
  .object({
    stream_id: str,
    name: str,
    stream_icon: str,
    category_id: str,
    rating: str,
    added: num,
    container_extension: str,
  })
  .transform((s) => ({
    id: s.stream_id,
    name: s.name.trim(),
    icon: s.stream_icon,
    categoryId: s.category_id,
    rating: s.rating,
    added: s.added,
    ext: s.container_extension || "mp4",
  }));

const SeriesSchema = z
  .object({
    series_id: str,
    name: str,
    cover: str,
    plot: str,
    genre: str,
    releaseDate: str,
    release_date: str,
    rating: str,
    backdrop_path: strList,
    category_id: str,
    last_modified: num,
  })
  .transform((s) => ({
    id: s.series_id,
    name: s.name.trim(),
    cover: s.cover,
    plot: s.plot,
    genre: s.genre,
    year: (s.releaseDate || s.release_date).slice(0, 4),
    rating: s.rating,
    backdrop: s.backdrop_path[0] ?? "",
    categoryId: s.category_id,
    added: s.last_modified,
  }));

const VodInfoSchema = z
  .object({
    info: z
      .object({
        movie_image: str,
        cover_big: str,
        backdrop_path: strList,
        plot: str,
        description: str,
        cast: str,
        actors: str,
        director: str,
        genre: str,
        releasedate: str,
        release_date: str,
        duration: str,
        duration_secs: num,
        rating: str,
        youtube_trailer: str,
      })
      .partial()
      .nullish()
      .transform((v) => v ?? {}),
    movie_data: z.object({ stream_id: str, name: str, container_extension: str }).partial().nullish(),
  })
  .transform((d) => ({
    plot: d.info.plot || d.info.description || "",
    cast: d.info.cast || d.info.actors || "",
    director: d.info.director ?? "",
    genre: d.info.genre ?? "",
    year: (d.info.releasedate || d.info.release_date || "").slice(0, 4),
    duration: d.info.duration ?? "",
    rating: d.info.rating ?? "",
    poster: d.info.movie_image || d.info.cover_big || "",
    backdrop: d.info.backdrop_path?.[0] ?? "",
    trailer: d.info.youtube_trailer ?? "",
    ext: d.movie_data?.container_extension || "",
  }));

const EpisodeSchema = z
  .object({
    id: str,
    episode_num: num,
    title: str,
    container_extension: str,
    season: num,
    info: z
      .object({ movie_image: str, plot: str, duration_secs: num, duration: str })
      .partial()
      .nullish()
      .transform((v) => v ?? {}),
  })
  .transform((e) => ({
    id: e.id,
    num: e.episode_num,
    title: e.title,
    ext: e.container_extension || "mp4",
    season: e.season,
    image: e.info.movie_image ?? "",
    plot: e.info.plot ?? "",
    duration: e.info.duration ?? "",
  }));

const SeriesInfoSchema = z.object({
  info: z
    .object({ name: str, cover: str, plot: str, cast: str, director: str, genre: str, releaseDate: str, rating: str, backdrop_path: strList })
    .partial()
    .nullish()
    .transform((v) => v ?? {}),
  seasons: z
    .array(z.object({ season_number: num, name: str }).partial())
    .nullish()
    .transform((v) => v ?? []),
  episodes: z
    .union([z.record(z.string(), z.array(z.unknown())), z.array(z.unknown())])
    .nullish()
    .transform((v) => v ?? {}),
});

const EpgSchema = z.object({
  epg_listings: z
    .array(z.object({ title: str, description: str, start_timestamp: num, stop_timestamp: num }))
    .nullish()
    .transform((v) => v ?? []),
});

/* ---------- public types ---------- */

export type Category = z.output<typeof CategorySchema>;
export type LiveStream = z.output<typeof LiveSchema>;
export type VodStream = z.output<typeof VodSchema>;
export type Series = z.output<typeof SeriesSchema>;
export type VodInfo = z.output<typeof VodInfoSchema>;
export type Episode = z.output<typeof EpisodeSchema>;
export type Season = { number: number; name: string; episodes: Episode[] };
export type SeriesInfo = {
  plot: string;
  cast: string;
  director: string;
  genre: string;
  year: string;
  rating: string;
  backdrop: string;
  cover: string;
  seasons: Season[];
};
export type EpgEntry = { title: string; description: string; start: number; end: number };
export type Account = { status: string; expiresAt: number | null; maxConnections: string; formats: string[] };
export type Credentials = { host: string; username: string; password: string };
export type MediaKind = "live" | "movie" | "series";

/* ---------- helpers ---------- */

/** Parses an XC list, tolerating object-maps and dropping malformed rows (logged). */
export function parseList<T>(schema: z.ZodType<T>, data: unknown, label: string): T[] {
  const rows = Array.isArray(data) ? data : data && typeof data === "object" ? Object.values(data) : [];
  const out: T[] = [];
  let dropped = 0;
  for (const row of rows) {
    const r = schema.safeParse(row);
    if (r.success) out.push(r.data);
    else dropped++;
  }
  if (dropped > 0) console.warn(`[xc] ${label}: dropped ${dropped}/${rows.length} malformed rows`);
  return out;
}

function decodeB64(s: string): string {
  try {
    const bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return s; // some panels send plain text instead of base64
  }
}

export class XcError extends Error {}

export class XcClient {
  readonly creds: Credentials;
  private cache = new Map<string, Promise<unknown>>();

  constructor(creds: Credentials) {
    this.creds = { ...creds, host: normalizeHost(creds.host) };
  }

  private async call(action?: string, params?: Record<string, string>, fresh = false): Promise<unknown> {
    const key = `${action ?? "auth"}:${JSON.stringify(params ?? {})}`;
    const cached = fresh ? undefined : this.cache.get(key);
    if (cached) return cached;

    const p = fetch("/api/xc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...this.creds, action, params }),
    }).then(async (res) => {
      const body: unknown = await res.json();
      if (!res.ok) {
        const msg = body && typeof body === "object" && "error" in body ? String(body.error) : `HTTP ${res.status}`;
        throw new XcError(msg);
      }
      return body;
    });
    this.cache.set(key, p);
    p.catch(() => this.cache.delete(key));
    return p;
  }

  /** Authenticates; `fresh` bypasses the cache (also re-registers the host in the stream proxy allowlist). */
  async authenticate(fresh = false): Promise<Account> {
    const parsed = AuthSchema.safeParse(await this.call(undefined, undefined, fresh));
    if (!parsed.success || parsed.data.user_info.auth !== 1) throw new XcError("Usuário ou senha inválidos");
    const u = parsed.data.user_info;
    const exp = Number(u.exp_date);
    return {
      status: u.status,
      expiresAt: Number.isFinite(exp) && exp > 0 ? exp * 1000 : null,
      maxConnections: u.max_connections,
      formats: u.allowed_output_formats,
    };
  }

  async categories(kind: MediaKind): Promise<Category[]> {
    const action = { live: "get_live_categories", movie: "get_vod_categories", series: "get_series_categories" }[kind];
    return parseList(CategorySchema, await this.call(action), action);
  }

  async liveStreams(): Promise<LiveStream[]> {
    return parseList(LiveSchema, await this.call("get_live_streams"), "live");
  }

  async vodStreams(): Promise<VodStream[]> {
    return parseList(VodSchema, await this.call("get_vod_streams"), "vod");
  }

  async series(): Promise<Series[]> {
    return parseList(SeriesSchema, await this.call("get_series"), "series");
  }

  async vodInfo(id: string): Promise<VodInfo> {
    const r = VodInfoSchema.safeParse(await this.call("get_vod_info", { vod_id: id }));
    if (!r.success) throw new XcError("Detalhes do filme indisponíveis");
    return r.data;
  }

  async seriesInfo(id: string): Promise<SeriesInfo> {
    const r = SeriesInfoSchema.safeParse(await this.call("get_series_info", { series_id: id }));
    if (!r.success) throw new XcError("Detalhes da série indisponíveis");
    const { info, seasons: seasonMeta, episodes: rawEpisodes } = r.data;

    const groups = Array.isArray(rawEpisodes) ? { "1": rawEpisodes } : rawEpisodes;
    const seasons: Season[] = Object.entries(groups)
      .map(([key, list]) => {
        const number = Number(key) || 0;
        const meta = seasonMeta.find((s) => s.season_number === number);
        const episodes = parseList(EpisodeSchema, list, `series ${id} S${key}`).sort((a, b) => a.num - b.num);
        return { number, name: meta?.name || `Temporada ${number}`, episodes };
      })
      .filter((s) => s.episodes.length > 0)
      .sort((a, b) => a.number - b.number);

    return {
      plot: info.plot ?? "",
      cast: info.cast ?? "",
      director: info.director ?? "",
      genre: info.genre ?? "",
      year: (info.releaseDate ?? "").slice(0, 4),
      rating: info.rating ?? "",
      backdrop: info.backdrop_path?.[0] ?? "",
      cover: info.cover ?? "",
      seasons,
    };
  }

  async shortEpg(streamId: string): Promise<EpgEntry[]> {
    const r = EpgSchema.safeParse(await this.call("get_short_epg", { stream_id: streamId, limit: "4" }));
    if (!r.success) return [];
    return r.data.epg_listings.map((e) => ({
      title: decodeB64(e.title),
      description: decodeB64(e.description),
      start: e.start_timestamp * 1000,
      end: e.stop_timestamp * 1000,
    }));
  }

  /** Proxied URL for a stream (`/stream?url=...`). */
  streamUrl(kind: MediaKind, id: string, ext: string): string {
    const { host, username, password } = this.creds;
    const raw = `${host}/${kind}/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${id}.${ext}`;
    return `/stream?url=${encodeURIComponent(raw)}`;
  }
}
