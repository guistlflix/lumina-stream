export function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** Lowercase, accent-free text for search matching. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Removes common XC name noise like "(2019)", "[4K]" or "PT-BR |" prefixes for display. */
export function cleanTitle(name: string): string {
  return name
    .replace(/^\s*[A-Z]{2,3}\s*[|:-]\s*/, "")
    .replace(/\s*\[[^\]]*\]\s*/g, " ")
    .trim();
}

export function yearFromName(name: string): string {
  return /\((\d{4})\)/.exec(name)?.[1] ?? "";
}

export function groupBy<T>(list: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of list) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/** Strips panel prefixes like "FILMES | ", "VOD - ", "SÉRIES: " and normalises ALL CAPS names. */
export function cleanCategory(name: string): string {
  const stripped = name
    .replace(/^\s*(?:(?:vod|filmes?|movies?|s[ée]ries?|series|tv)\s*[|:\-–»•]+\s*)+/i, "")
    .trim();
  const base = stripped || name.trim();
  const isUpper = base === base.toUpperCase() && /[A-ZÀ-Ú]/.test(base);
  if (!isUpper) return base;
  return base
    .split(/(\s+)/)
    .map((word, i) => {
      if (/^\s+$/.test(word) || /\d/.test(word) || KEEP_UPPER.has(word.replace(/[^\p{L}]/gu, ""))) return word;
      const lower = word.toLowerCase();
      if (i > 0 && LOWER_WORDS.has(lower)) return lower;
      return lower.replace(/\p{L}/u, (ch) => ch.toUpperCase());
    })
    .join("");
}

const KEEP_UPPER = new Set(["HD", "FHD", "UHD", "SD", "TV", "DC", "HBO", "UFC", "NBA", "NFL", "USA", "EUA", "BR", "PT", "LGBT", "LGBTQIA", "DVD", "MMA", "XXX"]);
const LOWER_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "em", "na", "no", "a", "o", "para", "com"]);
