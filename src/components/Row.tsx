import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconChevronLeft, IconChevronRight } from "./icons.tsx";

/** Horizontal shelf with paged arrow scrolling; renders children only once near the viewport. */
export function Row(props: { title: string; moreHref?: string; moreLabel?: string; variant?: "poster" | "wide" | "rank"; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setVisible(true), { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const update = () => {
    const t = track.current;
    if (!t) return;
    setEdges({ start: t.scrollLeft < 8, end: t.scrollLeft + t.clientWidth >= t.scrollWidth - 8 });
  };

  useEffect(update, [visible]);

  const page = (dir: 1 | -1) => {
    const t = track.current;
    if (t) t.scrollBy({ left: dir * t.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <section ref={host} className={`row row-${props.variant ?? "poster"}`}>
      <div className="row-head">
        <h2>{props.title}</h2>
        {props.moreHref && (
          <a className="row-more" href={props.moreHref}>
            {props.moreLabel ?? "Ver todos"}
          </a>
        )}
      </div>
      <div className="row-body">
        {!edges.start && (
          <button className="row-arrow left" aria-label="Anterior" onClick={() => page(-1)}>
            <IconChevronLeft />
          </button>
        )}
        <div className="row-track" ref={track} onScroll={update}>
          {visible ? props.children : <div className="row-placeholder" />}
        </div>
        {!edges.end && visible && (
          <button className="row-arrow right" aria-label="Próximo" onClick={() => page(1)}>
            <IconChevronRight />
          </button>
        )}
      </div>
    </section>
  );
}
