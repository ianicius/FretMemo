import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(scriptDirectory, "..");
const manifest = JSON.parse(await readFile(resolve(packageDirectory, "app-route-entrypoints.json"), "utf8"));
const EXCLUDED_ROOTS = new Set(["blog", "faq", "v1", "v2"]);

export function validateSpaRoute(route) {
  if (typeof route !== "string" || !route.startsWith("/") || route === "/" || route.includes("\\") || isAbsolute(route.slice(1))) {
    throw new Error(`Invalid SPA route: ${String(route)}`);
  }
  const segments = route.split("/").filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Unsafe SPA route: ${route}`);
  }
  if (EXCLUDED_ROOTS.has(segments[0])) {
    throw new Error(`Excluded static route: ${route}`);
  }
  return `/${segments.join("/")}`;
}

export async function generateSpaEntrypoints({ outDir, routes = manifest.routes } = {}) {
  const resolvedOutDir = resolve(outDir ?? resolve(packageDirectory, ".."));
  const shell = await readFile(resolve(resolvedOutDir, "index.html"), "utf8");
  const generated = [];
  for (const rawRoute of routes) {
    const route = validateSpaRoute(rawRoute);
    const routeDirectory = resolve(resolvedOutDir, `.${route}`);
    const relativeTarget = relative(resolvedOutDir, routeDirectory);
    if (relativeTarget.startsWith(`..${sep}`) || relativeTarget === "..") {
      throw new Error(`Route escapes output directory: ${route}`);
    }
    await mkdir(routeDirectory, { recursive: true });
    const target = resolve(routeDirectory, "index.html");
    await writeFile(target, shell, "utf8");
    generated.push(target);
  }
  return generated;
}

function readOutDirArgument(argv) {
  const index = argv.indexOf("--out-dir");
  if (index === -1) return resolve(packageDirectory, "..");
  if (!argv[index + 1]) throw new Error("--out-dir requires a path");
  return resolve(packageDirectory, argv[index + 1]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const generated = await generateSpaEntrypoints({ outDir: readOutDirArgument(process.argv.slice(2)) });
  console.log(`Generated ${generated.length} SPA entry points.`);
}
