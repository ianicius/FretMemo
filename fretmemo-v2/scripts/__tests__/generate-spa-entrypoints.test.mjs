import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import routeManifest from "../../app-route-entrypoints.json" with { type: "json" };
import { generateSpaEntrypoints, validateSpaRoute } from "../generate-spa-entrypoints.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function createOutputDirectory() {
  const path = await mkdtemp(join(tmpdir(), "fretmemo-entrypoints-"));
  temporaryDirectories.push(path);
  await writeFile(join(path, "index.html"), "<html><body>FretMemo shell</body></html>", "utf8");
  return path;
}

describe("generateSpaEntrypoints", () => {
  it("creates an identical application shell for every manifest route", async () => {
    const outDir = await createOutputDirectory();
    const generated = await generateSpaEntrypoints({ outDir });

    expect(routeManifest.routes).toHaveLength(27);
    expect(generated).toHaveLength(routeManifest.routes.length);
    for (const route of routeManifest.routes) {
      expect(await readFile(join(outDir, route.slice(1), "index.html"), "utf8"))
        .toBe("<html><body>FretMemo shell</body></html>");
    }
  });

  it("does not change excluded static surfaces", async () => {
    const outDir = await createOutputDirectory();
    for (const directory of ["blog", "v1", "v2"]) {
      await mkdir(join(outDir, directory), { recursive: true });
      await writeFile(join(outDir, directory, "index.html"), `${directory}-sentinel`, "utf8");
    }
    await writeFile(join(outDir, "faq.html"), "faq-sentinel", "utf8");

    await generateSpaEntrypoints({ outDir });

    expect(await readFile(join(outDir, "blog", "index.html"), "utf8")).toBe("blog-sentinel");
    expect(await readFile(join(outDir, "v1", "index.html"), "utf8")).toBe("v1-sentinel");
    expect(await readFile(join(outDir, "v2", "index.html"), "utf8")).toBe("v2-sentinel");
    expect(await readFile(join(outDir, "faq.html"), "utf8")).toBe("faq-sentinel");
  });

  it.each(["../escape", "/../escape", "/blog", "/faq", "/v1/tool", "/v2/tool", "/blog\\tool", "/foo\\..\\v1"])(
    "rejects unsafe or excluded route %s",
    (route) => expect(() => validateSpaRoute(route)).toThrow(),
  );
});
