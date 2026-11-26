import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { Header } from "./components/Header.tsx";
import { LibraryProvider, useLibrary } from "./lib/library.tsx";
import { useRoute } from "./lib/router.ts";
import { readJson, removeKey, writeJson } from "./lib/storage.ts";
import { XcClient, type Account, type Credentials } from "./lib/xc.ts";
import { Catalog } from "./pages/Catalog.tsx";
import { MovieDetail, ShowDetail } from "./pages/Details.tsx";
import { Home } from "./pages/Home.tsx";
import { Live } from "./pages/Live.tsx";
import { Loading } from "./pages/Loading.tsx";
import { Login } from "./pages/Login.tsx";
import { MyList, Search } from "./pages/Search.tsx";

// hls.js + mpegts.js are heavy: load the player only when something plays.
const Player = lazy(() => import("./components/Player.tsx").then((m) => ({ default: m.Player })));

const SESSION_KEY = "lumina:session";
const SessionSchema = z.object({ host: z.string().min(1), username: z.string().min(1), password: z.string().min(1) });

type Session = { client: XcClient; account: Account };

function Shell() {
  const route = useRoute();
  const { player } = useLibrary();

  useEffect(() => {
    document.body.style.overflow = player ? "hidden" : "";
  }, [player]);

  let page;
  switch (route.name) {
    case "home":
      page = <Home />;
      break;
    case "movies":
      page = <Catalog key={`m${route.cat ?? ""}`} kind="movies" cat={route.cat} />;
      break;
    case "series":
      page = <Catalog key={`s${route.cat ?? ""}`} kind="series" cat={route.cat} />;
      break;
    case "live":
      page = <Live cat={route.cat} />;
      break;
    case "search":
      page = <Search />;
      break;
    case "list":
      page = <MyList />;
      break;
    case "movie":
      page = <MovieDetail key={route.id} id={route.id} />;
      break;
    case "show":
      page = <ShowDetail key={route.id} id={route.id} />;
      break;
  }

  return (
    <>
      <Header route={route} />
      {page}
      <footer className="footer">Lumina · player para listas XC API</footer>
      {player && (
        <Suspense fallback={<div className="player"><div className="player-spinner" /></div>}>
          <Player />
        </Suspense>
      )}
    </>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string>();

  const connect = useCallback(async (creds: Credentials) => {
    const client = new XcClient(creds);
    const account = await client.authenticate();
    writeJson(SESSION_KEY, client.creds);
    setSession({ client, account });
  }, []);

  useEffect(() => {
    const stored = SessionSchema.safeParse(readJson<unknown>(SESSION_KEY, null));
    if (!stored.success) {
      setBooting(false);
      return;
    }
    // A network failure (server restarting, flaky link) is not an invalid session: retry once before showing login.
    connect(stored.data)
      .catch(async (err: unknown) => {
        if (!(err instanceof TypeError)) throw err;
        console.warn("[app] session restore network error, retrying", err);
        await new Promise((r) => setTimeout(r, 1500));
        return connect(stored.data);
      })
      .catch((err: unknown) => {
        console.warn("[app] stored session rejected", err);
        setBootError(err instanceof Error ? err.message : "Sessão expirada");
      })
      .finally(() => setBooting(false));
  }, [connect]);

  const logout = useCallback(() => {
    removeKey(SESSION_KEY);
    setSession(null);
    window.location.hash = "#/home";
  }, []);

  if (booting) return <Loading />;
  if (!session) return <Login onSubmit={connect} initialError={bootError} />;

  return (
    <LibraryProvider key={`${session.client.creds.host}|${session.client.creds.username}`} client={session.client} account={session.account} onLogout={logout}>
      <Shell />
    </LibraryProvider>
  );
}
