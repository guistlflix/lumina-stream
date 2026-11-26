import { useEffect, useState } from "react";

export type Route =
  | { name: "home" }
  | { name: "movies"; cat?: string }
  | { name: "series"; cat?: string }
  | { name: "live"; cat?: string }
  | { name: "search" }
  | { name: "list" }
  | { name: "movie"; id: string }
  | { name: "show"; id: string };

export function parseHash(hash: string): Route {
  const [path = "", query = ""] = hash.replace(/^#\/?/, "").split("?");
  const [section, id] = path.split("/");
  const cat = new URLSearchParams(query).get("cat") ?? undefined;
  switch (section) {
    case "movies":
      return { name: "movies", cat };
    case "series":
      return { name: "series", cat };
    case "live":
      return { name: "live", cat };
    case "search":
      return { name: "search" };
    case "list":
      return { name: "list" };
    case "movie":
      return id ? { name: "movie", id } : { name: "movies" };
    case "show":
      return id ? { name: "show", id } : { name: "series" };
    default:
      return { name: "home" };
  }
}

export function href(route: Route): string {
  switch (route.name) {
    case "movie":
    case "show":
      return `#/${route.name}/${encodeURIComponent(route.id)}`;
    case "movies":
    case "series":
    case "live":
      return route.cat ? `#/${route.name}?cat=${encodeURIComponent(route.cat)}` : `#/${route.name}`;
    default:
      return `#/${route.name}`;
  }
}

export function navigate(route: Route): void {
  window.location.hash = href(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
