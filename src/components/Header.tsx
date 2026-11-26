import { useEffect, useRef, useState } from "react";
import { href, type Route } from "../lib/router.ts";
import { useLibrary } from "../lib/library.tsx";
import { IconFilm, IconHome, IconLive, IconLogout, IconPlus, IconSearch, IconTv } from "./icons.tsx";

const NAV: Array<{ route: Route; label: string; Icon: typeof IconHome }> = [
  { route: { name: "home" }, label: "Início", Icon: IconHome },
  { route: { name: "search" }, label: "Busca", Icon: IconSearch },
  { route: { name: "list" }, label: "Minha lista", Icon: IconPlus },
  { route: { name: "movies" }, label: "Filmes", Icon: IconFilm },
  { route: { name: "series" }, label: "Séries", Icon: IconTv },
  { route: { name: "live" }, label: "Ao vivo", Icon: IconLive },
];

export function Logo() {
  return (
    <span className="logo">
      lumina<span className="logo-dot">+</span>
    </span>
  );
}

export function Header(props: { route: Route }) {
  const { logout, account, client } = useLibrary();
  const [solid, setSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const active = props.route.name === "movie" ? "movies" : props.route.name === "show" ? "series" : props.route.name;
  const expires = account.expiresAt ? new Date(account.expiresAt).toLocaleDateString("pt-BR") : "sem vencimento";

  return (
    <header className={`header ${solid ? "solid" : ""}`}>
      <a href="#/home" aria-label="Início">
        <Logo />
      </a>
      <nav className="nav">
        {NAV.map(({ route, label, Icon }) => (
          <a key={route.name} href={href(route)} className={`nav-item ${active === route.name ? "active" : ""}`}>
            <Icon width={18} height={18} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      <div className={`profile ${menuOpen ? "open" : ""}`} ref={profileRef}>
        <button
          className="avatar"
          aria-label="Conta"
          aria-expanded={menuOpen}
          title={`${client.creds.username} · expira ${expires}`}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {client.creds.username.slice(0, 1).toUpperCase()}
        </button>
        <div className="profile-menu">
          <div className="profile-name">{client.creds.username}</div>
          <div className="profile-meta">Status: {account.status || "—"}</div>
          <div className="profile-meta">Expira: {expires}</div>
          <div className="profile-meta">Conexões: {account.maxConnections || "—"}</div>
          <button className="profile-logout" onClick={logout}>
            <IconLogout width={16} height={16} /> Sair
          </button>
        </div>
      </div>
    </header>
  );
}
