import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import routeManifest from "../../app-route-entrypoints.json" with { type: "json" };
import {
  SPA_PRECACHE_GLOB_PATTERNS,
  createSpaNavigationFallbackAllowlist,
} from "../spa-navigation-policy.ts";

function isAllowedNavigation(pathnameAndSearch) {
  return createSpaNavigationFallbackAllowlist().some((pattern) => pattern.test(pathnameAndSearch));
}

describe("SPA navigation fallback policy", () => {
  it("keeps production on readable BrowserRouter URLs", () => {
    const productionEnvironment = readFileSync(
      resolve(process.cwd(), ".env.production"),
      "utf8",
    );
    expect(productionEnvironment).toMatch(/^VITE_USE_HASH_ROUTER=false$/m);
  });

  it("precaches only deployed application bundles and the root shell", () => {
    expect(SPA_PRECACHE_GLOB_PATTERNS).toEqual([
      "assets/**/*.{js,css}",
      "index.html",
    ]);
  });

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
