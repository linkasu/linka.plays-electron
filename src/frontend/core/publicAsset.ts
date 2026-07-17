export function resolvePublicAssetUrl(
  path: string,
  base = import.meta.env.BASE_URL || "/",
  locationHref = window.location.href
) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.replace(/^\/+/, "");
  return new URL(`${normalizedBase}${normalizedPath}`, locationHref).toString();
}
