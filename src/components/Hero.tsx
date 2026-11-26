import { useEffect, useState } from "react";
import { Art } from "./Art.tsx";
import { IconChevronLeft, IconChevronRight, IconPlay } from "./icons.tsx";

export type HeroSlide = { key: string; title: string; backdrop: string; poster: string; meta: string; plot: string; href: string };

export function Hero(props: { slides: HeroSlide[] }) {
  const { slides } = props;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  useEffect(() => {
    if (paused || count < 2) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), 7000);
    return () => window.clearInterval(t);
  }, [paused, count]);

  if (count === 0) return null;
  const go = (d: number) => setIndex((i) => (i + d + count) % count);

  return (
    <section className="hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="hero-track" style={{ transform: `translateX(calc(${-index} * (var(--hero-w) + var(--hero-gap))))` }}>
        {slides.map((s, i) => (
          <a key={s.key} href={s.href} className={`hero-slide ${i === index ? "current" : ""}`} tabIndex={i === index ? 0 : -1} aria-hidden={i !== index}>
            {s.backdrop ? (
              <Art src={s.backdrop} alt={s.title} className="hero-bg" eager={i < 2} />
            ) : (
              <>
                <div className="hero-bg blurred" style={{ backgroundImage: s.poster ? `url("${s.poster}")` : undefined }} />
                <Art src={s.poster} alt={s.title} className="hero-poster" eager={i < 2} />
              </>
            )}
            <div className="hero-shade" />
            <div className="hero-info">
              <h1>{s.title}</h1>
              {s.meta && <p className="hero-meta">{s.meta}</p>}
              {s.plot && <p className="hero-plot">{s.plot}</p>}
              <span className="btn btn-primary hero-cta">
                <IconPlay width={20} height={20} /> Ver detalhes
              </span>
            </div>
          </a>
        ))}
      </div>
      {count > 1 && (
        <>
          <button className="hero-arrow left" aria-label="Anterior" onClick={() => go(-1)}>
            <IconChevronLeft width={32} height={32} />
          </button>
          <button className="hero-arrow right" aria-label="Próximo" onClick={() => go(1)}>
            <IconChevronRight width={32} height={32} />
          </button>
          <div className="hero-dots">
            {slides.map((s, i) => (
              <button key={s.key} className={i === index ? "on" : ""} aria-label={`Destaque ${i + 1}`} onClick={() => setIndex(i)} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
