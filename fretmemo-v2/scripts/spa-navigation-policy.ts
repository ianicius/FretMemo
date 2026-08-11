import routeManifest from "../app-route-entrypoints.json";

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
