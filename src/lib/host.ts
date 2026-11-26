/** Accepts "host:port", "http://host:port/", "http://host/player_api.php?..." and returns "http://host:port[/path]". */
export function normalizeHost(input: string): string {
  const trimmed = input.trim();
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const url = new URL(withProto);
  const path = url.pathname.replace(/\/(player_api|get|xmltv)\.php$/i, "").replace(/\/+$/, "");
  return `${url.protocol}//${url.host}${path}`;
}
