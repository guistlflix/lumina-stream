import { useMemo, useState } from "react";
import { WideCard } from "../components/Cards.tsx";
import { useLibrary } from "../lib/library.tsx";
import { navigate } from "../lib/router.ts";
import { cleanCategory, fold } from "../lib/format.ts";
import { Loading } from "./Loading.tsx";
import { IconSearch } from "../components/icons.tsx";

export function Live(props: { cat?: string }) {
  const { catalog, catalogError, play } = useLibrary();
  const [query, setQuery] = useState("");

  const channels = useMemo(() => {
    if (!catalog) return [];
    const q = fold(query.trim());
    return catalog.live.filter((c) => (!props.cat || c.categoryId === props.cat) && (!q || fold(c.name).includes(q)));
  }, [catalog, props.cat, query]);

  if (catalogError) return <Loading error={catalogError} />;
  if (!catalog) return <Loading />;

  return (
    <main className="page live">
      <aside className="live-cats">
        <h1>Ao vivo</h1>
        <button className={!props.cat ? "on" : ""} onClick={() => navigate({ name: "live" })}>
          Todos os canais <span>{catalog.live.length}</span>
        </button>
        {catalog.liveCats.map((c) => (
          <button key={c.id} className={props.cat === c.id ? "on" : ""} onClick={() => navigate({ name: "live", cat: c.id })}>
            {cleanCategory(c.name)}
          </button>
        ))}
      </aside>
      <section className="live-main">
        <label className="search-inline">
          <IconSearch width={18} height={18} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar canais" />
        </label>
        {channels.length === 0 ? (
          <p className="empty">Nenhum canal encontrado.</p>
        ) : (
          <div className="grid wide">
            {channels.slice(0, 400).map((c, i) => (
              <WideCard
                key={c.id}
                title={c.name}
                image={c.icon}
                live
                contain
                onClick={() =>
                  play({ items: channels.map((x) => ({ kind: "live", id: x.id, ext: "m3u8", title: x.name, image: x.icon })), index: i })
                }
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
