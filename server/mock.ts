import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Minimal Xtream Codes compatible mock (credentials demo/demo) so the UI can be
 * exercised without a real panel. Media points to public test streams.
 */
export const MOCK_USER = "demo";
export const MOCK_PASS = "demo";

const HLS_SAMPLES = [
  "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8",
];
const MP4_SAMPLES = [
  "https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4",
  "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_5MB.mp4",
];

const PALETTES: ReadonlyArray<readonly [string, string]> = [
  ["#1e3c72", "#2a5298"],
  ["#42275a", "#734b6d"],
  ["#0f2027", "#2c5364"],
  ["#8e2de2", "#4a00e0"],
  ["#c31432", "#240b36"],
  ["#134e5e", "#71b280"],
  ["#ff512f", "#dd2476"],
  ["#1d2b64", "#f8cdda"],
  ["#000428", "#004e92"],
  ["#614385", "#516395"],
];

const LIVE_CATS = ["Notícias", "Esportes", "Entretenimento", "Infantil"];
const VOD_CATS = ["Ação", "Comédia", "Ficção Científica", "Animação", "Documentários", "Lançamentos"];
const SERIES_CATS = ["Drama", "Sci-Fi", "Comédia", "Suspense"];

const ADJ = ["Último", "Silencioso", "Eterno", "Perdido", "Dourado", "Sombrio", "Infinito", "Secreto", "Distante", "Selvagem"];
const NOUN = ["Horizonte", "Reino", "Código", "Oceano", "Planeta", "Legado", "Expresso", "Farol", "Labirinto", "Império"];
const PLOT =
  "Uma jornada inesperada coloca um grupo improvável diante de escolhas que vão mudar tudo. Entre segredos antigos e alianças frágeis, eles precisam descobrir em quem confiar antes que seja tarde demais.";

function title(i: number): string {
  return `O ${ADJ[i % ADJ.length]} ${NOUN[(i * 7 + 3) % NOUN.length]}`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

function svgImage(kind: string, id: number, label: string): string {
  const [a, b] = PALETTES[id % PALETTES.length] ?? ["#222", "#444"];
  const dims = kind === "backdrop" ? [1280, 720] : kind === "logo" ? [400, 400] : kind === "thumb" ? [640, 360] : [400, 600];
  const [w, h] = dims as [number, number];
  const words = label.split(" ");
  const lines: string[] = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && (last + " " + word).length <= 12) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  const fs = kind === "backdrop" ? 64 : kind === "logo" ? 52 : 44;
  const startY = kind === "backdrop" ? h * 0.72 : h / 2 - ((lines.length - 1) * fs * 1.1) / 2;
  const x = kind === "backdrop" ? 80 : w / 2;
  const anchor = kind === "backdrop" ? "start" : "middle";
  const text = lines
    .map((l, i) => `<text x="${x}" y="${startY + i * fs * 1.1}" font-family="Inter,Arial,sans-serif" font-weight="800" font-size="${fs}" fill="#fff" text-anchor="${anchor}">${esc(l)}</text>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<radialGradient id="r" cx="0.7" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="0.25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/><rect width="${w}" height="${h}" fill="url(#r)"/>
<circle cx="${w * 0.8}" cy="${h * 0.25}" r="${Math.min(w, h) * 0.18}" fill="#fff" opacity="0.08"/>${text}</svg>`;
}

function b64(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}

function json(res: ServerResponse, body: unknown): void {
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

export function handleMock(req: IncomingMessage, res: ServerResponse, url: URL): void {
  const base = `${url.protocol}//${req.headers.host ?? url.host}/mock`;
  const path = url.pathname.slice("/mock".length);
  const img = (kind: string, id: number, label: string) => `${base}/img/${kind}/${id}.svg?t=${encodeURIComponent(label)}`;

  const imgMatch = /^\/img\/(\w+)\/(\d+)\.svg$/.exec(path);
  if (imgMatch) {
    const [, kind = "poster", id = "0"] = imgMatch;
    res.writeHead(200, { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" });
    res.end(svgImage(kind, Number(id), url.searchParams.get("t") ?? ""));
    return;
  }

  const media = /^\/(live|movie|series)\/([^/]+)\/([^/]+)\/(\d+)\.(\w+)$/.exec(path);
  if (media) {
    const [, kind, u, p, idStr = "0"] = media;
    if (u !== MOCK_USER || p !== MOCK_PASS) {
      res.writeHead(403).end();
      return;
    }
    const id = Number(idStr);
    const location = kind === "live" ? HLS_SAMPLES[id % HLS_SAMPLES.length] : MP4_SAMPLES[id % MP4_SAMPLES.length];
    res.writeHead(302, { location: location ?? "" }).end();
    return;
  }

  if (path !== "/player_api.php") {
    res.writeHead(404).end();
    return;
  }

  const q = url.searchParams;
  if (q.get("username") !== MOCK_USER || q.get("password") !== MOCK_PASS) {
    json(res, { user_info: { auth: 0 } });
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const cats = (names: string[], offset: number) =>
    names.map((name, i) => ({ category_id: String(offset + i), category_name: name, parent_id: 0 }));

  const vod = Array.from({ length: 48 }, (_, i) => ({
    num: i + 1,
    name: `${title(i)} (${2015 + (i % 11)})`,
    stream_type: "movie",
    stream_id: 1000 + i,
    stream_icon: img("poster", i, title(i)),
    rating: String((6 + (i % 4) + 0.3).toFixed(1)),
    rating_5based: 3 + (i % 3) * 0.5,
    added: String(now - i * 86400),
    category_id: String(100 + (i % VOD_CATS.length)),
    container_extension: "mp4",
  }));

  const series = Array.from({ length: 20 }, (_, i) => ({
    num: i + 1,
    name: `${title(i + 30)}`,
    series_id: 2000 + i,
    cover: img("poster", i + 30, title(i + 30)),
    plot: PLOT,
    cast: "Ana Lima, Bruno Costa, Carla Mendes",
    director: "Diego Prado",
    genre: SERIES_CATS[i % SERIES_CATS.length],
    releaseDate: `${2018 + (i % 7)}-03-15`,
    last_modified: String(now - i * 3600),
    rating: String((7 + (i % 3)).toFixed(1)),
    backdrop_path: [img("backdrop", i + 30, title(i + 30))],
    category_id: String(200 + (i % SERIES_CATS.length)),
  }));

  const live = Array.from({ length: 24 }, (_, i) => ({
    num: i + 1,
    name: `${LIVE_CATS[i % LIVE_CATS.length]} ${i + 1} HD`,
    stream_type: "live",
    stream_id: 3000 + i,
    stream_icon: img("logo", i, `CH ${i + 1}`),
    epg_channel_id: `ch${i}`,
    added: String(now),
    category_id: String(300 + (i % LIVE_CATS.length)),
    tv_archive: 0,
  }));

  const byCat = <T extends { category_id: string }>(list: T[]) => {
    const c = q.get("category_id");
    return c ? list.filter((x) => x.category_id === c) : list;
  };

  switch (q.get("action")) {
    case null:
      return json(res, {
        user_info: {
          username: MOCK_USER,
          auth: 1,
          status: "Active",
          exp_date: String(now + 90 * 86400),
          is_trial: "0",
          active_cons: "0",
          max_connections: "2",
          allowed_output_formats: ["m3u8", "ts"],
        },
        server_info: { url: req.headers.host ?? "", port: "80", server_protocol: "http", timezone: "America/Sao_Paulo" },
      });
    case "get_live_categories":
      return json(res, cats(LIVE_CATS, 300));
    case "get_vod_categories":
      return json(res, cats(VOD_CATS, 100));
    case "get_series_categories":
      return json(res, cats(SERIES_CATS, 200));
    case "get_live_streams":
      return json(res, byCat(live));
    case "get_vod_streams":
      return json(res, byCat(vod));
    case "get_series":
      return json(res, byCat(series));
    case "get_vod_info": {
      const v = vod.find((x) => String(x.stream_id) === q.get("vod_id"));
      if (!v) return json(res, []);
      const i = v.stream_id - 1000;
      return json(res, {
        info: {
          movie_image: v.stream_icon,
          backdrop_path: [img("backdrop", i, title(i))],
          plot: PLOT,
          cast: "Marina Alves, Rafael Souza, Júlia Rocha",
          director: "Helena Duarte",
          genre: VOD_CATS[i % VOD_CATS.length],
          releasedate: `${2015 + (i % 11)}-06-01`,
          duration: "01:38:00",
          duration_secs: 5880,
          rating: v.rating,
        },
        movie_data: { stream_id: v.stream_id, name: v.name, container_extension: "mp4" },
      });
    }
    case "get_series_info": {
      const s = series.find((x) => String(x.series_id) === q.get("series_id"));
      if (!s) return json(res, []);
      const seasons = [1, 2];
      const episodes: Record<string, unknown[]> = {};
      for (const season of seasons) {
        episodes[String(season)] = Array.from({ length: 6 }, (_, e) => {
          const epId = s.series_id * 100 + season * 10 + e;
          return {
            id: String(epId),
            episode_num: e + 1,
            title: `${s.name} - S0${season}E0${e + 1}`,
            container_extension: "mp4",
            season,
            info: { movie_image: img("thumb", epId, `Episódio ${e + 1}`), plot: PLOT, duration_secs: 2700, duration: "00:45:00" },
          };
        });
      }
      return json(res, {
        seasons: seasons.map((n) => ({ season_number: n, name: `Temporada ${n}`, episode_count: 6 })),
        info: { ...s },
        episodes,
      });
    }
    case "get_short_epg": {
      const start = now - (now % 3600);
      return json(res, {
        epg_listings: [0, 1, 2].map((k) => ({
          title: b64(k === 0 ? "Programa ao vivo" : `Próximo programa ${k}`),
          description: b64("Descrição do programa de demonstração."),
          start_timestamp: String(start + k * 3600),
          stop_timestamp: String(start + (k + 1) * 3600),
        })),
      });
    }
    default:
      return json(res, []);
  }
}
