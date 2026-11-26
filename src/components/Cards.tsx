import { Art } from "./Art.tsx";
import { IconPlay } from "./icons.tsx";

export function PosterCard(props: { title: string; image: string; href?: string; onClick?: () => void; badge?: string; progress?: number }) {
  const inner = (
    <>
      <Art src={props.image} alt={props.title} className="card-img" />
      {props.badge && <span className="card-badge">{props.badge}</span>}
      {props.progress !== undefined && (
        <div className="card-progress">
          <div style={{ width: `${Math.min(100, Math.max(2, props.progress * 100))}%` }} />
        </div>
      )}
      <span className="card-title">{props.title}</span>
    </>
  );
  if (props.href)
    return (
      <a className="card poster" href={props.href} title={props.title}>
        {inner}
      </a>
    );
  return (
    <button className="card poster" onClick={props.onClick} title={props.title}>
      {inner}
    </button>
  );
}

export function WideCard(props: { title: string; subtitle?: string; image: string; onClick: () => void; progress?: number; live?: boolean; contain?: boolean }) {
  return (
    <button className={`card wide ${props.contain ? "contain" : ""}`} onClick={props.onClick} title={props.title}>
      <Art src={props.image} alt={props.title} className="card-img" />
      <div className="card-hover-play">
        <IconPlay width={28} height={28} />
      </div>
      {props.live && <span className="card-live">AO VIVO</span>}
      {props.progress !== undefined && (
        <div className="card-progress">
          <div style={{ width: `${Math.min(100, Math.max(2, props.progress * 100))}%` }} />
        </div>
      )}
      <div className="card-caption">
        <strong>{props.title}</strong>
        {props.subtitle && <span>{props.subtitle}</span>}
      </div>
    </button>
  );
}

/** Top-10 style card: oversized outlined rank number beside the poster. */
export function RankCard(props: { rank: number; title: string; image: string; href: string }) {
  return (
    <a className="rank-card" href={props.href} title={props.title}>
      <span className="rank-num" aria-hidden="true">
        {props.rank}
      </span>
      <span className="card poster rank-poster">
        <Art src={props.image} alt={props.title} className="card-img" />
      </span>
      <span className="card-title">{`${props.rank}. ${props.title}`}</span>
    </a>
  );
}
