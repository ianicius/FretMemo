import { describe, expect, it } from "vitest";

import routeManifest from "../../app-route-entrypoints.json" with { type: "json" };
import { createSpaNavigationFallbackAllowlist } from "../spa-navigation-policy.ts";

function isAllowedNavigation(pathnameAndSearch) {
  return createSpaNavigationFallbackAllowlist().some((pattern) => pattern.test(pathnameAndSearch));
}

describe("SPA navigation fallback policy", () => {
  it("allows only the root and manifest routes with optional trailing slashes", () => {
    expect(routeManifest.routes).toHaveLength(27);
    expect(isAllowedNavigation("/")).toBe(true);

    for (const route of routeManifest.routes) {
      expect(isAllowedNavigation(route)).toBe(true);
      expect(isAllowedNavigation(`${route}/`)).toBe(true);
      expect(isAllowedNavigation(`${route}?source=pwa`)).toBe(true);
    }
  });

  it.each([
    "/unknown",
    "/unknown/",
    "/train/unknown",
    "/blog",
    "/blog/",
    "/blog.html",
    "/faq",
    "/faq.html",
    "/v1",
    "/v1/tool",
    "/v2",
    "/v2/tool",
  ])("lets non-application navigation %s fall through to the network", (route) => {
    expect(isAllowedNavigation(route)).toBe(false);
  });
});
