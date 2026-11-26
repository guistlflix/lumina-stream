import { IconFilm, IconLive, IconPlus, IconStar, IconTv } from "./icons.tsx";

const TILES = [
  { href: "#/movies", label: "Filmes", Icon: IconFilm, from: "#2b5876", to: "#4e4376" },
  { href: "#/series", label: "Séries", Icon: IconTv, from: "#614385", to: "#516395" },
  { href: "#/live", label: "Ao vivo", Icon: IconLive, from: "#cb2d3e", to: "#ef473a" },
  { href: "#/list", label: "Minha lista", Icon: IconPlus, from: "#11998e", to: "#38ef7d" },
  { href: "#/search", label: "Descobrir", Icon: IconStar, from: "#f7971e", to: "#ffd200" },
];

export function Tiles() {
  return (
    <div className="tiles">
      {TILES.map(({ href, label, Icon, from, to }) => (
        <a key={href} className="tile" href={href} style={{ ["--from" as string]: from, ["--to" as string]: to }}>
          <Icon width={34} height={34} />
          <span>{label}</span>
        </a>
      ))}
    </div>
  );
}
