import { useDeferredValue, useMemo, useState } from "react";
import { PosterCard, WideCard } from "../components/Cards.tsx";
import { useLibrary } from "../lib/library.tsx";
import { href } from "../lib/router.ts";
import { cleanTitle, fold } from "../lib/format.ts";
import { Loading } from "./Loading.tsx";

const MAX = 60;

export function Search() {
  const { catalog, catalogError, play } = useLibrary();
  const [query, setQuery] = useState("");
  const q = useDeferredValue(fold(query.trim()));

  const results = useMemo(() => {
    if (!catalog || q.length < 2) return null;
    const match = (name: string) => fold(name).includes(q);
    return {
      movies: catalog.vod.filter((v) => match(v.name)).slice(0, MAX),
      series: catalog.series.filter((s) => match(s.name)).slice(0, MAX),
      live: catalog.live.filter((c) => match(c.name)).slice(0, MAX),
    };
  }, [catalog, q]);

  if (catalogError) return <Loading error={catalogError} />;
  if (!catalog) return <Loading />;

  const total = results ? results.movies.length + results.series.length + results.live.length : 0;

  return (
    <main className="page search">
      <input className="search-big" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Busque por título, série ou canal" aria-label="Buscar" />
      {!results && (
        <p className="empty">
          Digite pelo menos 2 letras. Catálogo: {catalog.vod.length.toLocaleString("pt-BR")} filmes · {catalog.series.length.toLocaleString("pt-BR")} séries ·{" "}
          {catalog.live.length.toLocaleString("pt-BR")} canais
        </p>
      )}
      {results && total === 0 && <p className="empty">Nenhum resultado para “{query}”.</p>}
      {results && results.movies.length > 0 && (
        <section className="search-group">
          <h2>Filmes</h2>
          <div className="grid">
            {results.movies.map((v) => (
              <PosterCard key={v.id} title={cleanTitle(v.name)} image={v.icon} href={href({ name: "movie", id: v.id })} />
            ))}
          </div>
        </section>
      )}
      {results && results.series.length > 0 && (
        <section className="search-group">
          <h2>Séries</h2>
          <div className="grid">
            {results.series.map((s) => (
              <PosterCard key={s.id} title={cleanTitle(s.name)} image={s.cover} href={href({ name: "show", id: s.id })} />
            ))}
          </div>
        </section>
      )}
      {results && results.live.length > 0 && (
        <section className="search-group">
          <h2>Canais</h2>
          <div className="grid wide">
            {results.live.map((c, i, arr) => (
              <WideCard
                key={c.id}
                title={c.name}
                image={c.icon}
                live
                contain
                onClick={() => play({ items: arr.map((x) => ({ kind: "live", id: x.id, ext: "m3u8", title: x.name, image: x.icon })), index: i })}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export function MyList() {
  const { favorites, play } = useLibrary();
  const live = favorites.filter((f) => f.kind === "live");
  const vod = favorites.filter((f) => f.kind !== "live");
  return (
    <main className="page search">
      <h1 className="page-title">Minha lista</h1>
      {favorites.length === 0 && <p className="empty">Use o botão + na página de um título para adicioná-lo aqui.</p>}
      {vod.length > 0 && (
        <div className="grid">
          {vod.map((f) => (
            <PosterCard key={`${f.kind}${f.id}`} title={f.name} image={f.image} href={href({ name: f.kind === "movie" ? "movie" : "show", id: f.id })} />
          ))}
        </div>
      )}
      {live.length > 0 && (
        <section className="search-group">
          <h2>Canais</h2>
          <div className="grid wide">
            {live.map((f, i) => (
              <WideCard
                key={f.id}
                title={f.name}
                image={f.image}
                live
                contain
                onClick={() => play({ items: live.map((x) => ({ kind: "live", id: x.id, ext: "m3u8", title: x.name, image: x.image })), index: i })}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
