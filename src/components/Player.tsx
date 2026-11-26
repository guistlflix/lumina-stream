import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import mpegts from "mpegts.js";
import { progressKey, useLibrary, type PlayItem } from "../lib/library.tsx";
import type { EpgEntry } from "../lib/xc.ts";
import { formatTime } from "../lib/format.ts";
import {
  IconBack,
  IconCheck,
  IconDown,
  IconExitFullscreen,
  IconForward,
  IconFullscreen,
  IconMute,
  IconNext,
  IconPause,
  IconPlus,
  IconPlay,
  IconRewind,
  IconUp,
  IconVolume,
} from "./icons.tsx";

type Engine = { destroy: () => void };

/** Formats to try, in order, for an item. Live channels fall back between HLS and MPEG-TS. */
function candidates(item: PlayItem, formats: string[]): string[] {
  if (item.kind !== "live") return [item.ext];
  const allowsHls = formats.length === 0 || formats.includes("m3u8");
  const allowsTs = formats.length === 0 || formats.includes("ts");
  return [...(allowsHls ? ["m3u8"] : []), ...(allowsTs ? ["ts"] : [])];
}

function attach(video: HTMLVideoElement, url: string, ext: string, live: boolean, onFatal: (reason: string) => void): Engine {
  if (ext === "m3u8" && Hls.isSupported()) {
    const hls = new Hls({ enableWorker: true, lowLatencyMode: live, backBufferLength: live ? 30 : 90 });
    let recovered = false;
    hls.on(Hls.Events.ERROR, (_evt, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) {
        recovered = true;
        console.warn("[player] hls media error, recovering", data.details);
        hls.recoverMediaError();
        return;
      }
      console.error("[player] hls fatal", data.type, data.details);
      onFatal(`HLS: ${data.details}`);
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    return { destroy: () => hls.destroy() };
  }

  if (ext === "ts" && mpegts.getFeatureList().mseLivePlayback) {
    const p = mpegts.createPlayer({ type: "mpegts", isLive: live, url }, { enableStashBuffer: false, liveBufferLatencyChasing: live });
    p.on(mpegts.Events.ERROR, (type: string, detail: string) => {
      console.error("[player] mpegts fatal", type, detail);
      onFatal(`MPEG-TS: ${detail}`);
    });
    p.attachMediaElement(video);
    p.load();
    return {
      destroy: () => {
        p.pause();
        p.unload();
        p.detachMediaElement();
        p.destroy();
      },
    };
  }

  const onError = () => {
    const code = video.error?.code ?? 0;
    console.error("[player] native playback error", code, video.error?.message);
    onFatal(code === 4 ? `Não foi possível abrir o arquivo .${ext}: servidor indisponível ou formato não suportado pelo navegador.` : "Erro ao reproduzir");
  };
  video.addEventListener("error", onError);
  video.src = url;
  return {
    destroy: () => {
      video.removeEventListener("error", onError);
      video.removeAttribute("src");
      video.load();
    },
  };
}

export function Player() {
  const { player, closePlayer, play, client, account, progress, saveProgress, isFavorite, toggleFavorite } = useLibrary();
  const video = useRef<HTMLVideoElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [controls, setControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [epg, setEpg] = useState<EpgEntry[]>([]);
  const [attempt, setAttempt] = useState(0);

  const req = player;
  const item = req ? req.items[req.index] : undefined;
  const isLive = item?.kind === "live";
  const hasNext = !!req && req.index < req.items.length - 1;
  const hasPrev = !!req && req.index > 0;

  const goTo = useCallback(
    (index: number) => {
      if (!req || index < 0 || index >= req.items.length) return;
      play({ items: req.items, index });
    },
    [req, play],
  );

  /* ---- attach engine, with format fallback ---- */
  useEffect(() => {
    const v = video.current;
    if (!v || !item) return;
    const formats = candidates(item, account.formats);
    let engine: Engine | null = null;
    let disposed = false;

    setError(null);
    setWaiting(true);
    setTime(0);
    setDuration(0);

    const tryFormat = (i: number) => {
      if (disposed) return;
      const ext = formats[i];
      if (!ext) {
        setError("Não foi possível reproduzir este conteúdo.");
        setWaiting(false);
        return;
      }
      engine?.destroy();
      engine = attach(v, client.streamUrl(item.kind, item.id, ext), ext, item.kind === "live", (reason) => {
        if (disposed) return;
        if (i + 1 < formats.length) {
          console.warn(`[player] ${reason} — trying .${formats[i + 1]}`);
          tryFormat(i + 1);
          return;
        }
        setError(reason);
        setWaiting(false);
      });
      v.play().catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.warn("[player] autoplay blocked", err);
        setPlaying(false);
      });
    };
    // Re-validates the session first: keeps the proxy allowlist warm even after a server restart.
    client
      .authenticate(true)
      .then(() => tryFormat(0))
      .catch((err: unknown) => {
        console.error("[player] session check failed", err);
        if (disposed) return;
        setError(err instanceof Error ? err.message : "Sessão inválida");
        setWaiting(false);
      });

    return () => {
      disposed = true;
      if (item.kind !== "live" && v.duration > 0) saveProgress(item, v.currentTime, v.duration);
      engine?.destroy();
    };
  }, [item?.kind, item?.id, attempt]);

  /* ---- resume ---- */
  useEffect(() => {
    const v = video.current;
    if (!v || !item || item.kind === "live") return;
    const saved = progress[progressKey(item.kind, item.id)];
    if (!saved || saved.position < 30 || saved.position / saved.duration > 0.95) return;
    const onMeta = () => {
      v.currentTime = saved.position;
      setToast(`Retomando de ${formatTime(saved.position)}`);
      window.setTimeout(() => setToast(null), 3000);
    };
    v.addEventListener("loadedmetadata", onMeta, { once: true });
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, [item?.kind, item?.id]);

  /* ---- periodic progress save ---- */
  useEffect(() => {
    if (!item || item.kind === "live") return;
    const t = window.setInterval(() => {
      const v = video.current;
      if (v && !v.paused && v.duration > 0) saveProgress(item, v.currentTime, v.duration);
    }, 5000);
    return () => window.clearInterval(t);
  }, [item, saveProgress]);

  /* ---- EPG for live ---- */
  useEffect(() => {
    if (!item || item.kind !== "live") return setEpg([]);
    let cancelled = false;
    client
      .shortEpg(item.id)
      .then((list) => !cancelled && setEpg(list))
      .catch((err: unknown) => console.warn(`[player] epg unavailable stream=${item.id}`, err));
    return () => {
      cancelled = true;
    };
  }, [item, client]);

  /* ---- controls auto-hide ---- */
  const poke = useCallback(() => {
    setControls(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControls(false), 3200);
  }, []);
  useEffect(() => {
    poke();
    return () => window.clearTimeout(hideTimer.current);
  }, [poke, item?.id]);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === shell.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play().catch((err: unknown) => console.warn("[player] play failed", err));
    else v.pause();
  }, []);

  const seekBy = useCallback(
    (d: number) => {
      const v = video.current;
      if (!v || isLive) return;
      v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d));
      poke();
    },
    [isLive, poke],
  );

  const toggleFs = useCallback(() => {
    const el = shell.current;
    if (!el) return;
    const op = document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen();
    op.catch((err: unknown) => console.warn("[player] fullscreen failed", err));
  }, []);

  const setVol = (val: number) => {
    const v = video.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
  };

  const close = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch((err: unknown) => console.warn("[player] exit fullscreen failed", err));
    closePlayer();
  }, [closePlayer]);

  /* ---- keyboard ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = video.current;
      if (!v) return;
      poke();
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          toggle();
          break;
        case "ArrowLeft":
          seekBy(-10);
          break;
        case "ArrowRight":
          seekBy(10);
          break;
        case "ArrowUp":
          e.preventDefault();
          if (isLive) goTo((req?.index ?? 0) - 1);
          else setVol(Math.min(1, v.volume + 0.1));
          break;
        case "ArrowDown":
          e.preventDefault();
          if (isLive) goTo((req?.index ?? 0) + 1);
          else setVol(Math.max(0, v.volume - 0.1));
          break;
        case "f":
          toggleFs();
          break;
        case "m":
          v.muted = !v.muted;
          break;
        case "Escape":
          if (!document.fullscreenElement) close();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, seekBy, toggleFs, close, poke, goTo, isLive, req?.index]);

  if (!req || !item) return null;

  const now = Date.now();
  const current = epg.find((e) => e.start <= now && e.end > now);
  const upcoming = epg.find((e) => e.start > now);
  const pct = duration > 0 ? (time / duration) * 100 : 0;
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const nextItem = hasNext ? req.items[req.index + 1] : undefined;
  const nearEnd = !isLive && duration > 0 && duration - time < 40;

  return (
    <div ref={shell} className={`player ${controls || !playing ? "show-ui" : ""}`} onMouseMove={poke} onClick={poke}>
      <video
        ref={video}
        className="player-video"
        playsInline
        autoPlay
        onClick={toggle}
        onDoubleClick={toggleFs}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onProgress={(e) => {
          const b = e.currentTarget.buffered;
          if (b.length > 0) setBuffered(b.end(b.length - 1));
        }}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onEnded={() => {
          if (item.kind !== "live") saveProgress(item, duration, duration);
          if (hasNext) goTo(req.index + 1);
        }}
      />

      {waiting && !error && <div className="player-spinner" aria-label="Carregando" />}
      {toast && <div className="player-toast">{toast}</div>}

      {error && (
        <div className="player-error">
          <h3>Ops! Algo deu errado</h3>
          <p>{error}</p>
          <div className="player-error-actions">
            <button className="btn btn-primary" onClick={() => setAttempt((a) => a + 1)}>
              Tentar novamente
            </button>
            <button className="btn btn-ghost" onClick={close}>
              Voltar
            </button>
          </div>
        </div>
      )}

      <div className="player-top">
        <button className="icon-btn" aria-label="Voltar" onClick={close}>
          <IconBack width={30} height={30} />
        </button>
        <div className="player-title">
          <strong>{item.title}</strong>
          {item.subtitle && <span>{item.subtitle}</span>}
        </div>
        {isLive && (
          <button
            className={`round-btn player-fav ${isFavorite("live", item.id) ? "on" : ""}`}
            aria-label={isFavorite("live", item.id) ? "Remover canal da lista" : "Adicionar canal à lista"}
            onClick={() => toggleFavorite({ kind: "live", id: item.id, name: item.title, image: item.image })}
          >
            {isFavorite("live", item.id) ? <IconCheck width={20} height={20} /> : <IconPlus width={20} height={20} />}
          </button>
        )}
      </div>

      {isLive && (current || upcoming) && (
        <div className="player-epg">
          {current && (
            <div>
              <span className="epg-now">AGORA</span> {current.title}
              <div className="epg-bar">
                <div style={{ width: `${((now - current.start) / (current.end - current.start)) * 100}%` }} />
              </div>
            </div>
          )}
          {upcoming && (
            <div className="epg-next">
              A seguir · {new Date(upcoming.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} {upcoming.title}
            </div>
          )}
        </div>
      )}

      {nearEnd && nextItem && (
        <button className="player-next-card" onClick={() => goTo(req.index + 1)}>
          <IconNext width={18} height={18} /> Próximo: {nextItem.subtitle ?? nextItem.title}
        </button>
      )}

      <div className="player-bottom">
        {!isLive ? (
          <div className="player-timeline">
            <div className="track">
              <div className="buffered" style={{ width: `${bufPct}%` }} />
              <div className="played" style={{ width: `${pct}%` }} />
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={time}
                aria-label="Posição"
                onChange={(e) => {
                  const v = video.current;
                  if (v) v.currentTime = Number(e.target.value);
                }}
              />
            </div>
            <span className="time">-{formatTime(Math.max(0, duration - time))}</span>
          </div>
        ) : (
          <div className="player-timeline live">
            <span className="live-dot" /> AO VIVO
          </div>
        )}

        <div className="player-controls">
          <div className="group">
            <button className="icon-btn big" aria-label={playing ? "Pausar" : "Reproduzir"} onClick={toggle}>
              {playing ? <IconPause width={34} height={34} /> : <IconPlay width={34} height={34} />}
            </button>
            {!isLive && (
              <>
                <button className="icon-btn" aria-label="Voltar 10 segundos" onClick={() => seekBy(-10)}>
                  <IconRewind width={30} height={30} />
                </button>
                <button className="icon-btn" aria-label="Avançar 10 segundos" onClick={() => seekBy(10)}>
                  <IconForward width={30} height={30} />
                </button>
              </>
            )}
            {isLive && (
              <>
                <button className="icon-btn" aria-label="Canal anterior" disabled={!hasPrev} onClick={() => goTo(req.index - 1)}>
                  <IconUp width={28} height={28} />
                </button>
                <button className="icon-btn" aria-label="Próximo canal" disabled={!hasNext} onClick={() => goTo(req.index + 1)}>
                  <IconDown width={28} height={28} />
                </button>
              </>
            )}
            <div className="volume">
              <button className="icon-btn" aria-label={muted ? "Ativar som" : "Silenciar"} onClick={() => setVol(muted || volume === 0 ? 1 : 0)}>
                {muted || volume === 0 ? <IconMute width={28} height={28} /> : <IconVolume width={28} height={28} />}
              </button>
              <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} aria-label="Volume" onChange={(e) => setVol(Number(e.target.value))} />
            </div>
          </div>
          <div className="group">
            {!isLive && hasNext && (
              <button className="icon-btn labeled" onClick={() => goTo(req.index + 1)}>
                <IconNext width={24} height={24} /> Próximo
              </button>
            )}
            <button className="icon-btn" aria-label="Tela cheia" onClick={toggleFs}>
              {fullscreen ? <IconExitFullscreen width={28} height={28} /> : <IconFullscreen width={28} height={28} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
