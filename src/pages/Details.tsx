import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Art } from "../components/Art.tsx";
import { PosterCard, WideCard } from "../components/Cards.tsx";
import { Row } from "../components/Row.tsx";
import { IconCheck, IconPlay, IconPlus } from "../components/icons.tsx";
import { progressKey, useLibrary, type PlayItem } from "../lib/library.tsx";
import { href } from "../lib/router.ts";
import { cleanTitle, yearFromName } from "../lib/format.ts";
import type { SeriesInfo, VodInfo } from "../lib/xc.ts";
import { Loading } from "./Loading.tsx";

function useAsync<T>(fn: () => Promise<T>, key: string): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null }>({ key: "", data: null, error: null });
  useEffect(() => {
    let cancelled = false;
    fn()
      .then((data) => !cancelled && setState({ key, data, error: null }))
      .catch((err: unknown) => {
        console.error(`[details] load failed key=${key}`, err);
        if (!cancelled) setState({ key, data: null, error: err instanceof Error ? err.message : "Falha ao carregar" });
      });
    return () => {
      cancelled = true;
    };
  }, [key]); // fn is recreated each render; `key` identifies the request
  return state.key === key ? state : { data: null, error: null };
}

type LayoutProps = {
  title: string;
  backdrop: string;
  poster: string;
  meta: string[];
  actions: ReactNode;
  plot: string;
  facts: Array<[string, string]>;
  children?: ReactNode;
};

function DetailLayout(props: LayoutProps) {
  return (
    <main className="page details">
      <div className="details-bg">
        {props.backdrop ? (
          <Art src={props.backdrop} alt="" className="details-bg-img" eager />
        ) : (
          <div className="details-bg-img blurred" style={{ backgroundImage: props.poster ? `url("${props.poster}")` : undefined }} />
        )}
        <div className="details-shade" />
      </div>
      <div className="details-content">
        <h1 className="details-title">{props.title}</h1>
        <p className="details-meta">{props.meta.filter(Boolean).join("  •  ")}</p>
        <div className="details-actions">{props.actions}</div>
        {props.plot && <p className="details-plot">{props.plot}</p>}
        <dl className="details-facts">
          {props.facts
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>
      </div>
      {props.children}
    </main>
  );
}

function FavButton(props: { on: boolean; onClick: () => void }) {
  const label = props.on ? "Remover da lista" : "Adicionar à lista";
  return (
    <button className={`round-btn ${props.on ? "on" : ""}`} aria-label={label} title={label} onClick={props.onClick}>
      {props.on ? <IconCheck /> : <IconPlus />}
    </button>
  );
}

export function MovieDetail(props: { id: string }) {
  const { client, catalog, play, progress, isFavorite, toggleFavorite } = useLibrary();
  const stream = catalog?.vod.find((v) => v.id === props.id);
  const { data: info, error } = useAsync<VodInfo>(() => client.vodInfo(props.id), `vod:${props.id}`);

  const similar = useMemo(
    () => (stream && catalog ? catalog.vod.filter((v) => v.categoryId === stream.categoryId && v.id !== stream.id).slice(0, 30) : []),
    [catalog, stream],
  );

  if (!catalog) return <Loading />;
  if (!stream && error) return <Loading error={error} />;

  const name = stream?.name ?? "Filme";
  const title = cleanTitle(name.replace(/\(\d{4}\)/, ""));
  const poster = info?.poster || stream?.icon || "";
  const rating = info?.rating || stream?.rating || "";
  const item: PlayItem = { kind: "movie", id: props.id, ext: info?.ext || stream?.ext || "mp4", title, image: info?.backdrop || poster };
  const saved = progress[progressKey("movie", props.id)];
  const resumable = !!saved && saved.position > 30 && saved.position / saved.duration < 0.95;

  return (
    <DetailLayout
      title={title}
      backdrop={info?.backdrop ?? ""}
      poster={poster}
      meta={[info?.year || yearFromName(name), info?.duration ?? "", info?.genre ?? "", rating ? `★ ${rating}` : ""]}
      plot={info ? info.plot : error ? "" : "Carregando…"}
      facts={[
        ["Direção", info?.director ?? ""],
        ["Elenco", info?.cast ?? ""],
      ]}
      actions={
        <>
          <button className="btn btn-primary" onClick={() => play({ items: [item], index: 0, resume: resumable })}>
            <IconPlay width={20} height={20} /> {resumable ? "Continuar" : "Assistir"}
          </button>
          {resumable && saved && (
            <div className="resume-bar" title="Progresso">
              <div style={{ width: `${(saved.position / saved.duration) * 100}%` }} />
            </div>
          )}
          <FavButton on={isFavorite("movie", props.id)} onClick={() => toggleFavorite({ kind: "movie", id: props.id, name: title, image: poster })} />
        </>
      }
    >
      {similar.length > 0 && (
        <div className="details-extra">
          <Row title="Sugestões">
            {similar.map((v) => (
              <PosterCard key={v.id} title={cleanTitle(v.name)} image={v.icon} href={href({ name: "movie", id: v.id })} />
            ))}
          </Row>
        </div>
      )}
    </DetailLayout>
  );
}

function episodeLabel(seriesTitle: string, episodeTitle: string, num: number): string {
  const stripped = episodeTitle.replace(seriesTitle, "").replace(/^[\s\-–:|]+/, "").replace(/^S\d+E\d+[\s\-–:]*/i, "").trim();
  return stripped || `Episódio ${num}`;
}

export function ShowDetail(props: { id: string }) {
  const { client, catalog, play, progress, isFavorite, toggleFavorite } = useLibrary();
  const series = catalog?.series.find((s) => s.id === props.id);
  const { data: info, error } = useAsync<SeriesInfo>(() => client.seriesInfo(props.id), `series:${props.id}`);
  const [seasonIdx, setSeasonIdx] = useState(0);

  const title = cleanTitle(series?.name ?? "Série");
  const cover = info?.cover || series?.cover || "";
  const backdrop = info?.backdrop || series?.backdrop || "";

  const queue = useMemo<PlayItem[]>(
    () =>
      (info?.seasons ?? []).flatMap((s) =>
        s.episodes.map((e) => ({
          kind: "series" as const,
          id: e.id,
          ext: e.ext,
          title,
          subtitle: `T${s.number}:E${e.num} · ${episodeLabel(title, e.title, e.num)}`,
          image: e.image || backdrop || cover,
          seriesId: props.id,
        })),
      ),
    [info, title, cover, backdrop, props.id],
  );

  if (!catalog) return <Loading />;
  if (error && !info) return <Loading error={error} />;

  const lastWatched = queue
    .map((q, i) => ({ i, p: progress[progressKey("series", q.id)] }))
    .filter((x) => x.p !== undefined)
    .sort((a, b) => (b.p?.updatedAt ?? 0) - (a.p?.updatedAt ?? 0))[0];
  const startIndex = lastWatched?.i ?? 0;
  const seasons = info?.seasons ?? [];
  const season = seasons[seasonIdx];
  const offset = seasons.slice(0, seasonIdx).reduce((n, s) => n + s.episodes.length, 0);
  const startLabel = queue[startIndex]?.subtitle?.split(" · ")[0] ?? "";

  return (
    <DetailLayout
      title={title}
      backdrop={backdrop}
      poster={cover}
      meta={[
        info?.year || series?.year || "",
        info?.genre || series?.genre || "",
        info ? `${seasons.length} temporada${seasons.length === 1 ? "" : "s"}` : "",
        info?.rating ? `★ ${info.rating}` : "",
      ]}
      plot={info?.plot || series?.plot || ""}
      facts={[
        ["Direção", info?.director ?? ""],
        ["Elenco", info?.cast ?? ""],
      ]}
      actions={
        <>
          <button className="btn btn-primary" disabled={queue.length === 0} onClick={() => play({ items: queue, index: startIndex, resume: true })}>
            <IconPlay width={20} height={20} /> {lastWatched ? `Continuar ${startLabel}` : "Assistir"}
          </button>
          <FavButton on={isFavorite("series", props.id)} onClick={() => toggleFavorite({ kind: "series", id: props.id, name: title, image: cover })} />
        </>
      }
    >
      <div className="details-extra">
        {!info ? (
          <div className="loader small" />
        ) : (
          <>
            <div className="season-tabs" role="tablist">
              {seasons.map((s, i) => (
                <button key={s.number} role="tab" aria-selected={i === seasonIdx} className={i === seasonIdx ? "on" : ""} onClick={() => setSeasonIdx(i)}>
                  {s.name}
                </button>
              ))}
            </div>
            <div className="episodes">
              {season?.episodes.map((e, i) => {
                const q = queue[offset + i];
                if (!q) return null;
                const p = progress[progressKey("series", e.id)];
                return (
                  <div key={e.id} className="episode">
                    <WideCard
                      title={`${e.num}. ${episodeLabel(title, e.title, e.num)}`}
                      subtitle={e.duration}
                      image={q.image}
                      progress={p ? p.position / p.duration : undefined}
                      onClick={() => play({ items: queue, index: offset + i, resume: true })}
                    />
                    {e.plot && <p className="episode-plot">{e.plot}</p>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DetailLayout>
  );
}
