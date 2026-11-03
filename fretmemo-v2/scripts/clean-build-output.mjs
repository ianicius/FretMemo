import { readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Removes generated deploy artifacts from the repo root before a fresh build.
 *
 * Vite builds into the repo root with `emptyOutDir: false` to protect static
 * surfaces (blog/, v1/, v2/, faq.html). Without this cleanup, stale hashed
 * assets from previous builds survive on disk and land in the service-worker
 * precache, because the assets glob picks up both generations.
 */
export async function cleanBuildOutput(rootDir) {
    const root = resolve(rootDir);
    await rm(resolve(root, "assets"), { recursive: true, force: true });
    await rm(resolve(root, "sw.js"), { force: true });
    for (const entry of await readdir(root)) {
        if (/^workbox-.*\.js$/.test(entry)) {
            await rm(resolve(root, entry), { force: true });
        }
    }
}

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
    const target = process.argv[2] ? resolve(process.argv[2]) : defaultRoot;
    await cleanBuildOutput(target);
    console.log(`cleaned generated build output in ${target} (assets/, sw.js, workbox-*.js)`);
}
