import { describe, expect, it } from "vitest";
import { normalizeHost } from "../src/lib/host.ts";
import { rewritePlaylist } from "../server/proxy.ts";
import { XcClient } from "../src/lib/xc.ts";
import { cleanCategory, cleanTitle, fold, formatTime } from "../src/lib/format.ts";
import { parseHash, href } from "../src/lib/router.ts";

describe("normalizeHost", () => {
  it("adds protocol and strips trailing slash", () => {
    expect(normalizeHost("server.com:8080/")).toBe("http://server.com:8080");
  });
  it("strips player_api.php", () => {
    expect(normalizeHost("https://x.tv/player_api.php?username=a")).toBe("https://x.tv");
  });
  it("keeps sub-paths", () => {
    expect(normalizeHost("http://127.0.0.1:8787/mock/")).toBe("http://127.0.0.1:8787/mock");
  });
});

describe("rewritePlaylist", () => {
  it("proxies segment lines and URI attributes, resolving relative refs", () => {
    const src = ["#EXTM3U", '#EXT-X-KEY:METHOD=AES-128,URI="key.bin"', "#EXTINF:10,", "seg1.ts", "https://cdn.x/abs.ts", ""].join("\n");
    const out = rewritePlaylist(src, "http://h.tv/live/a/b/1.m3u8").split("\n");
    expect(out[0]).toBe("#EXTM3U");
    expect(out[1]).toBe(`#EXT-X-KEY:METHOD=AES-128,URI="/stream?url=${encodeURIComponent("http://h.tv/live/a/b/key.bin")}"`);
    expect(out[3]).toBe(`/stream?url=${encodeURIComponent("http://h.tv/live/a/b/seg1.ts")}`);
    expect(out[4]).toBe(`/stream?url=${encodeURIComponent("https://cdn.x/abs.ts")}`);
  });
});

describe("XcClient.streamUrl", () => {
  it("builds proxied XC paths with encoded credentials", () => {
    const c = new XcClient({ host: "h.tv:8080/", username: "u@x", password: "p/1" });
    const url = c.streamUrl("movie", "42", "mkv");
    expect(decodeURIComponent(url.replace("/stream?url=", ""))).toBe("http://h.tv:8080/movie/u%40x/p%2F1/42.mkv");
  });
});

describe("format helpers", () => {
  it("formats time", () => {
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(3725)).toBe("1:02:05");
  });
  it("folds accents", () => {
    expect(fold("Ação Épica")).toBe("acao epica");
  });
  it("cleans category prefixes and caps", () => {
    expect(cleanCategory("FILMES | AÇÃO E AVENTURA")).toBe("Ação e Aventura");
    expect(cleanCategory("VOD - Comédia")).toBe("Comédia");
    expect(cleanCategory("Séries: Netflix")).toBe("Netflix");
    expect(cleanCategory("4K")).toBe("4K");
  });
  it("cleans XC noise", () => {
    expect(cleanTitle("BR | Filme Legal [4K]")).toBe("Filme Legal");
  });
});

describe("router", () => {
  it("round-trips routes", () => {
    expect(parseHash(href({ name: "movies", cat: "12" }))).toEqual({ name: "movies", cat: "12" });
    expect(parseHash(href({ name: "show", id: "99" }))).toEqual({ name: "show", id: "99" });
    expect(parseHash("#/whatever")).toEqual({ name: "home" });
  });
});
