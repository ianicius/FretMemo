import routeManifest from "../app-route-entrypoints.json";

export const SPA_PRECACHE_GLOB_PATTERNS = [
  "assets/**/*.{js,css}",
  // Bravura music glyphs are fetched at runtime by alphaTab; precaching them
  // keeps offline /scores rendering intact. (Plain extension glob: single-value
  // brace expansion does not match in the workbox glob setup.)
  "font/**/*.woff2",
  "index.html",
] as const;

function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createSpaNavigationFallbackAllowlist(
  routes: readonly string[] = routeManifest.routes,
) {
  const allowedPaths = ["/", ...routes.flatMap((route) => [route, `${route}/`])];
  const alternatives = allowedPaths.map(escapeRegularExpression).join("|");
  return [new RegExp(`^(?:${alternatives})(?:\\?.*)?$`)];
}
