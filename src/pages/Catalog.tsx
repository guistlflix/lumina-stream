import { useMemo, useState } from "react";
import { PosterCard, RankCard } from "../components/Cards.tsx";
import { Hero, type HeroSlide } from "../components/Hero.tsx";
import { Row } from "../components/Row.tsx";
import { useLibrary } from "../lib/library.tsx";
import { href } from "../lib/router.ts";
import { cleanCategory, cleanTitle, fold, groupBy, yearFromName } from "../lib/format.ts";
import { Loading } from "./Loading.tsx";

const PAGE = 120;
const PER_ROW = 30;

type Kind = "movies" | "series";
type Item = { id: string; name: string; image: string; backdrop: string; added: number; rating: number; categoryId: string; meta: string; plot: string };

function titleKey(name: string): string {
  return fold(cleanTitle(name))
    .replace(/\((?:\d{4}|leg(?:endado)?|dub(?:lado)?|nacional)\)/g, "")
    .replace(/\b(?:legendado|dublado|leg|dub|4k|fhd|hd)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueByTitle<T extends { name: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((i) => {
    const k = titleKey(i.name);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function GenreBar(props: { kind: Kind; cats: Array<{ id: string; name: string; count: number }>; active?: string }) {
  return (
    <nav className="genre-bar" aria-label="Categorias">
      <a className={`genre-chip ${!props.active ? "on" : ""}`} href={href({ name: props.kind })}>
        Destaques
      </a>
      {props.cats.map((c) => (
        <a key={c.id} className={`genre-chip ${props.active === c.id ? "on" : ""}`} href={href({ name: props.kind, cat: c.id })}>
          {c.name}
          <span>{c.count}</span>
        </a>
      ))}
    </nav>
  );
}

export function Catalog(props: { kind: Kind; cat?: string }) {
  const { catalog, catalogError } = useLibrary();
  const [limit, setLimit] = useState(PAGE);
  const [sort, setSort] = useState<"recent" | "az" | "rating">("recent");

  const data = useMemo(() => {
    if (!catalog) return null;
    const isMovies = props.kind === "movies";
    const items: Item[] = isMovies
      ? catalog.vod.map((v) => ({
          id: v.id,
          name: v.name,
          image: v.icon,
          backdrop: "",
          added: v.added,
          rating: Number(v.rating) || 0,
          categoryId: v.categoryId,
          meta: [yearFromName(v.name), "Filme", v.rating && Number(v.rating) > 0 ? `★ ${v.rating}` : ""].filter(Boolean).join(" • "),
          plot: "",
        }))
      : catalog.series.map((s) => ({
          id: s.id,
          name: s.name,
          image: s.cover,
          backdrop: s.backdrop,
          added: s.added,
          rating: Number(s.rating) || 0,
          categoryId: s.categoryId,
          meta: [s.year, s.genre, "Série"].filter(Boolean).join(" • "),
          plot: s.plot,
        }));
    const byCat = groupBy(items, (i) => i.categoryId);
    const cats = (isMovies ? catalog.vodCats : catalog.seriesCats)
      .map((c) => ({ id: c.id, name: cleanCategory(c.name), count: byCat.get(c.id)?.length ?? 0 }))
      .filter((c) => c.count > 0);
    // Panels often list the same title twice (dubbed + subtitled); highlight shelves show each once.
    const recent = uniqueByTitle([...items].sort((a, b) => b.added - a.added));
    const top = uniqueByTitle(items.filter((i) => i.rating > 0).sort((a, b) => b.rating - a.rating || b.added - a.added)).slice(0, 10);
    const withArt = recent.filter((i) => i.backdrop || i.image);
    const featured = [...withArt.filter((i) => i.backdrop), ...withArt.filter((i) => !i.backdrop)].slice(0, 6);
    return { items, byCat, cats, recent: recent.slice(0, PER_ROW), top, featured };
  }, [catalog, props.kind]);

  const filtered = useMemo(() => {
    if (!data || !props.cat) return [];
    const list = [...(data.byCat.get(props.cat) ?? [])];
    if (sort === "az") return list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    if (sort === "rating") return list.sort((a, b) => b.rating - a.rating);
    return list.sort((a, b) => b.added - a.added);
  }, [data, props.cat, sort]);

  if (catalogError) return <Loading error={catalogError} />;
  if (!catalog || !data) return <Loading />;

  const title = props.kind === "movies" ? "Filmes" : "Séries";
  const detail = props.kind === "movies" ? "movie" : "show";
  const card = (it: Item) => <PosterCard key={it.id} title={cleanTitle(it.name)} image={it.image} href={href({ name: detail, id: it.id })} />;

  /* ---------- single category: header + grid ---------- */
  if (props.cat) {
    const cat = data.cats.find((c) => c.id === props.cat);
    return (
      <main className="page catalog">
        <div className="catalog-head">
          <div>
            <a className="crumb" href={href({ name: props.kind })}>
              {title}
            </a>
            <h1>{cat?.name ?? "Categoria"}</h1>
          </div>
          <select className="select small" value={sort} aria-label="Ordenar" onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="recent">Mais recentes</option>
            <option value="rating">Mais bem avaliados</option>
            <option value="az">A–Z</option>
          </select>
          <span className="count">{filtered.length.toLocaleString("pt-BR")} títulos</span>
        </div>
        <GenreBar kind={props.kind} cats={data.cats} active={props.cat} />
        {filtered.length === 0 ? <p className="empty">Nenhum título nesta categoria.</p> : <div className="grid">{filtered.slice(0, limit).map(card)}</div>}
        {filtered.length > limit && (
          <div className="more">
            <button className="btn btn-ghost" onClick={() => setLimit((l) => l + PAGE)}>
              Carregar mais
            </button>
          </div>
        )}
      </main>
    );
  }

  /* ---------- landing: hero + genre bar + shelves ---------- */
  const slides: HeroSlide[] = data.featured.map((i) => ({
    key: i.id,
    title: cleanTitle(i.name.replace(/\(\d{4}\)/, "")),
    backdrop: i.backdrop,
    poster: i.image,
    meta: i.meta,
    plot: i.plot,
    href: href({ name: detail, id: i.id }),
  }));

  return (
    <main className="page catalog landing">
      <h1 className="catalog-title">{title}</h1>
      <Hero slides={slides} />
      <GenreBar kind={props.kind} cats={data.cats} />

      {data.top.length >= 3 && (
        <Row title={`Top 10 ${title.toLowerCase()} mais bem avaliados`} variant="rank">
          {data.top.map((it, i) => (
            <RankCard key={it.id} rank={i + 1} title={cleanTitle(it.name)} image={it.image} href={href({ name: detail, id: it.id })} />
          ))}
        </Row>
      )}

      {data.recent.length > 0 && <Row title="Adicionados recentemente">{data.recent.map(card)}</Row>}

      {data.cats.map((cat) => {
        const list = data.byCat.get(cat.id) ?? [];
        return (
          <Row key={cat.id} title={cat.name} moreHref={href({ name: props.kind, cat: cat.id })} moreLabel={`Ver todos (${cat.count})`}>
            {[...list].sort((a, b) => b.added - a.added).slice(0, PER_ROW).map(card)}
          </Row>
        );
      })}
    </main>
  );
}
