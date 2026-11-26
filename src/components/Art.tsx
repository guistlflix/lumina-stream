import { useState } from "react";

/** Image with a branded gradient fallback when the panel artwork is missing or broken. */
export function Art(props: { src: string; alt: string; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const { src, alt, className, eager } = props;
  if (!src || failed) {
    const hue = [...alt].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
    return (
      <div className={`art-fallback ${className ?? ""}`} style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 28%), hsl(${(hue + 50) % 360} 60% 14%))` }}>
        <span>{alt}</span>
      </div>
    );
  }
  return <img className={className} src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
