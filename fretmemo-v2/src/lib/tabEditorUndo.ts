/**
 * Score snapshot/restore for the tab editor's undo stack (roadmap R-07).
 *
 * alphaTab 1.9 has no undo API — the editor snapshots the whole score via
 * `JsonConverter.scoreToJson` before each mutation and restores with
 * `jsonToScore`. alphaTab is imported dynamically so this stays out of any
 * bundle that doesn't use the editor.
 */

/** See snapshotScore — async variant loading alphaTab on demand. */
export async function snapshotScoreAsync(score: unknown): Promise<string> {
    const alphatab = await import("@coderline/alphatab");
    return alphatab.model.JsonConverter.scoreToJson(score as never);
}

/**
 * Restores a JSON snapshot back into a live Score model. `jsonToScore` runs
 * `score.finish` internally, so the restored model is immediately render- and
 * playback-ready.
 */
export async function restoreScoreSnapshot(json: string): Promise<unknown> {
    const alphatab = await import("@coderline/alphatab");
    return alphatab.model.JsonConverter.jsonToScore(json);
}
