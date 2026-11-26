import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readJson, writeJson } from "./storage.ts";
import type { Account, Category, LiveStream, MediaKind, Series, VodStream, XcClient } from "./xc.ts";

export type PlayItem = {
  kind: MediaKind;
  id: string;
  ext: string;
  title: string;
  subtitle?: string;
  image: string;
  seriesId?: string;
};

export type PlayRequest = { items: PlayItem[]; index: number; resume?: boolean };

export type Progress = { item: PlayItem; position: number; duration: number; updatedAt: number };
export type Favorite = { kind: MediaKind; id: string; name: string; image: string };

export type Catalog = {
  liveCats: Category[];
  vodCats: Category[];
  seriesCats: Category[];
  live: LiveStream[];
  vod: VodStream[];
  series: Series[];
};

type LibraryValue = {
  client: XcClient;
  account: Account;
  catalog: Catalog | null;
  catalogError: string | null;
  favorites: Favorite[];
  isFavorite: (kind: MediaKind, id: string) => boolean;
  toggleFavorite: (fav: Favorite) => void;
  progress: Record<string, Progress>;
  saveProgress: (item: PlayItem, position: number, duration: number) => void;
  player: PlayRequest | null;
  play: (req: PlayRequest) => void;
  closePlayer: () => void;
  logout: () => void;
};

const LibraryContext = createContext<LibraryValue | null>(null);

export function progressKey(kind: MediaKind, id: string): string {
  return `${kind}:${id}`;
}

export function LibraryProvider(props: { client: XcClient; account: Account; onLogout: () => void; children: ReactNode }) {
  const { client, account, onLogout } = props;
  const ns = `lumina:${client.creds.host}:${client.creds.username}`;

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>(() => readJson(`${ns}:favorites`, []));
  const [progress, setProgress] = useState<Record<string, Progress>>(() => readJson(`${ns}:progress`, {}));
  const [player, setPlayer] = useState<PlayRequest | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      client.categories("live"),
      client.categories("movie"),
      client.categories("series"),
      client.liveStreams(),
      client.vodStreams(),
      client.series(),
    ])
      .then(([liveCats, vodCats, seriesCats, live, vod, series]) => {
        if (!cancelled) setCatalog({ liveCats, vodCats, seriesCats, live, vod, series });
      })
      .catch((err: unknown) => {
        console.error("[library] catalog load failed", err);
        if (!cancelled) setCatalogError(err instanceof Error ? err.message : "Falha ao carregar catálogo");
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const toggleFavorite = useCallback(
    (fav: Favorite) => {
      setFavorites((prev) => {
        const exists = prev.some((f) => f.kind === fav.kind && f.id === fav.id);
        const next = exists ? prev.filter((f) => !(f.kind === fav.kind && f.id === fav.id)) : [fav, ...prev];
        writeJson(`${ns}:favorites`, next);
        return next;
      });
    },
    [ns],
  );

  const isFavorite = useCallback((kind: MediaKind, id: string) => favorites.some((f) => f.kind === kind && f.id === id), [favorites]);

  const saveProgress = useCallback(
    (item: PlayItem, position: number, duration: number) => {
      if (item.kind === "live" || !Number.isFinite(duration) || duration <= 0) return;
      setProgress((prev) => {
        const key = progressKey(item.kind, item.id);
        const next = { ...prev, [key]: { item, position, duration, updatedAt: Date.now() } };
        writeJson(`${ns}:progress`, next);
        return next;
      });
    },
    [ns],
  );

  const value = useMemo<LibraryValue>(
    () => ({
      client,
      account,
      catalog,
      catalogError,
      favorites,
      isFavorite,
      toggleFavorite,
      progress,
      saveProgress,
      player,
      play: setPlayer,
      closePlayer: () => setPlayer(null),
      logout: onLogout,
    }),
    [client, account, catalog, catalogError, favorites, isFavorite, toggleFavorite, progress, saveProgress, player, onLogout],
  );

  return <LibraryContext.Provider value={value}>{props.children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used inside <LibraryProvider>");
  return ctx;
}
