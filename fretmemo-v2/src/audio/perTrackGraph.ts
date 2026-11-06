/**
 * Per-track playback graph assembly (roadmap: per-track rendering).
 *
 * Takes the per-track rendered buffers plus resolved voice plans and wires
 * the playback graph: one buffer source per track routed either through a
 * dedicated preset chain (chain.input → … → chain.output → master) or
 * directly into the shared playback master. Muted tracks are skipped.
 *
 * Extracted from ScoreViewer so the graph wiring is unit-testable with the
 * fake AudioContext fixtures.
 */
import { assembleChain, type AssembledChain } from "@/audio/chain";
import { masterGainValue } from "@/audio/engine";
import type { SoundPreset } from "@/audio/presets";
import type { ChainAudioNode } from "@/audio/chain";

export interface ResolvedTrackOutput {
    trackIndex: number;
    buffer: AudioBuffer;
    /** Resolved voice plan for this track. */
    plan:
        | { kind: "preset"; preset: SoundPreset; ampNode?: AudioNode }
        | { kind: "direct" };
    muted: boolean;
}

export interface AssembledTrackGraph {
    /** Per-track sources for `MultiTrackPlayback`. */
    sources: Array<{ trackIndex: number; buffer: AudioBuffer; destination: AudioNode | ChainAudioNode }>;
    /** Assembled chains — dispose() them (and master) on teardown. */
    chains: AssembledChain[];
    master: GainNode;
    /** Tracks skipped as muted (their buffers are not part of the graph). */
    mutedTrackIndexes: number[];
    dispose(): void;
}

/**
 * Wires per-track buffers into per-track chains (or the direct master path)
 * and returns the playback sources. Every preset chain gets its output
 * connected into the shared master — a chain without a downstream link is
 * acoustically dead.
 */
export function assemblePerTrackGraph(
    ctx: BaseAudioContext,
    outputs: ResolvedTrackOutput[],
    masterVolume: number,
): AssembledTrackGraph {
    const master = ctx.createGain();
    master.gain.value = masterGainValue(masterVolume);
    master.connect(ctx.destination);

    const chains: AssembledChain[] = [];
    const sources: Array<{ trackIndex: number; buffer: AudioBuffer; destination: AudioNode | ChainAudioNode }> = [];
    const mutedTrackIndexes: number[] = [];

    for (const output of outputs) {
        if (output.muted) {
            mutedTrackIndexes.push(output.trackIndex);
            continue;
        }
        if (output.plan.kind === "preset") {
            const chain = assembleChain(ctx, output.plan.preset, {
                ampNode: output.plan.ampNode,
            });
            chains.push(chain);
            // Buffer feeds the chain input; the chain output drives the master.
            chain.output.connect(master);
            sources.push({ trackIndex: output.trackIndex, buffer: output.buffer, destination: chain.input });
        } else {
            sources.push({ trackIndex: output.trackIndex, buffer: output.buffer, destination: master });
        }
    }

    return {
        sources,
        chains,
        master,
        mutedTrackIndexes,
        dispose(): void {
            for (const source of sources) {
                const destination = source.destination as { disconnect?: unknown } | null;
                if (destination && typeof destination.disconnect === "function") {
                    (destination.disconnect as () => void).call(destination);
                }
            }
            for (const chain of chains) {
                // Disconnect the downstream link first, then the chain itself.
                const output = chain.output as { disconnect?: unknown } | null;
                if (output && typeof output.disconnect === "function") {
                    (output.disconnect as () => void).call(output);
                }
                chain.dispose();
            }
            master.disconnect();
        },
    };
}
