import { useMemo } from "react";
import { Hero, type HeroSlide } from "../components/Hero.tsx";
import { Tiles } from "../components/Tiles.tsx";
import { Row } from "../components/Row.tsx";
import { PosterCard, WideCard } from "../components/Cards.tsx";
import { useLibrary } from "../lib/library.tsx";
import { href } from "../lib/router.ts";
import { cleanCategory, cleanTitle, groupBy, yearFromName } from "../lib/format.ts";
import { Loading } from "./Loading.tsx";

const PER_ROW = 30;

export function Home() {
  const { catalog, catalogError, progress, favorites, play } = useLibrary();

  const data = useMemo(() => {
    if (!catalog) return null;
    const recentVod = [...catalog.vod].sort((a, b) => b.added - a.added);
    const recentSeries = [...catalog.series].sort((a, b) => b.added - a.added);
    const slides: HeroSlide[] = [
      ...recentSeries
        .filter((s) => s.backdrop)
        .slice(0, 5)
        .map((s) => ({
          key: `s${s.id}`,
          title: cleanTitle(s.name),
          backdrop: s.backdrop,
          poster: s.cover,
          meta: [s.year, s.genre, "Série"].filter(Boolean).join(" • "),
          plot: s.plot,
          href: href({ name: "show", id: s.id }),
        })),
      ...recentVod.slice(0, 8 - Math.min(5, recentSeries.filter((s) => s.backdrop).length)).map((v) => ({
        key: `m${v.id}`,
        title: cleanTitle(v.name.replace(/\(\d{4}\)/, "")),
        backdrop: "",
        poster: v.icon,
        meta: [yearFromName(v.name), "Filme", v.rating && `★ ${v.rating}`].filter(Boolean).join(" • "),
        plot: "",
        href: href({ name: "movie", id: v.id }),
      })),
    ];
    return {
      slides,
      recentVod: recentVod.slice(0, PER_ROW),
      recentSeries: recentSeries.slice(0, PER_ROW),
      vodByCat: groupBy(catalog.vod, (v) => v.categoryId),
      seriesByCat: groupBy(catalog.series, (s) => s.categoryId),
    };
  }, [catalog]);

  const continueWatching = useMemo(
    () =>
      Object.values(progress)
        .filter((p) => p.position / p.duration > 0.02 && p.position / p.duration < 0.95)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 20),
    [progress],
  );

  if (catalogError) return <Loading error={catalogError} />;
  if (!catalog || !data) return <Loading />;

  return (
    <main className="page home">
      <Hero slides={data.slides} />
      <Tiles />

      {continueWatching.length > 0 && (
        <Row title="Continuar assistindo" variant="wide">
          {continueWatching.map((p) => (
            <WideCard
              key={`${p.item.kind}${p.item.id}`}
              title={p.item.title}
              subtitle={p.item.subtitle}
              image={p.item.image}
              progress={p.position / p.duration}
              onClick={() => play({ items: [p.item], index: 0, resume: true })}
            />
          ))}
        </Row>
      )}

      {favorites.length > 0 && (
        <Row title="Minha lista" moreHref="#/list">
          {favorites.slice(0, PER_ROW).map((f) =>
            f.kind === "live" ? null : (
              <PosterCard key={`${f.kind}${f.id}`} title={f.name} image={f.image} href={href({ name: f.kind === "movie" ? "movie" : "show", id: f.id })} />
            ),
          )}
        </Row>
      )}

      {data.recentVod.length > 0 && (
        <Row title="Filmes adicionados recentemente" moreHref="#/movies">
          {data.recentVod.map((v) => (
            <PosterCard key={v.id} title={cleanTitle(v.name)} image={v.icon} href={href({ name: "movie", id: v.id })} />
          ))}
        </Row>
      )}

      {data.recentSeries.length > 0 && (
        <Row title="Séries em destaque" moreHref="#/series">
          {data.recentSeries.map((s) => (
            <PosterCard key={s.id} title={cleanTitle(s.name)} image={s.cover} href={href({ name: "show", id: s.id })} />
          ))}
        </Row>
      )}

      {catalog.live.length > 0 && (
        <Row title="Canais ao vivo" variant="wide" moreHref="#/live">
          {catalog.live.slice(0, PER_ROW).map((c, i, arr) => (
            <WideCard
              key={c.id}
              title={c.name}
              image={c.icon}
              live
              contain
              onClick={() =>
                play({
                  items: arr.map((x) => ({ kind: "live", id: x.id, ext: "m3u8", title: x.name, image: x.icon })),
                  index: i,
                })
              }
            />
          ))}
        </Row>
      )}

      {catalog.vodCats.map((cat) => {
        const list = data.vodByCat.get(cat.id);
        if (!list?.length) return null;
        return (
          <Row key={`v${cat.id}`} title={cleanCategory(cat.name)} moreHref={href({ name: "movies", cat: cat.id })}>
            {list.slice(0, PER_ROW).map((v) => (
              <PosterCard key={v.id} title={cleanTitle(v.name)} image={v.icon} href={href({ name: "movie", id: v.id })} />
            ))}
          </Row>
        );
      })}

      {catalog.seriesCats.map((cat) => {
        const list = data.seriesByCat.get(cat.id);
        if (!list?.length) return null;
        return (
          <Row key={`s${cat.id}`} title={`Séries · ${cleanCategory(cat.name)}`} moreHref={href({ name: "series", cat: cat.id })}>
            {list.slice(0, PER_ROW).map((s) => (
              <PosterCard key={s.id} title={cleanTitle(s.name)} image={s.cover} href={href({ name: "show", id: s.id })} />
            ))}
          </Row>
        );
      })}
    </main>
  );
}
