import { describe, expect, it } from "vitest";
import {
    FakeAudioBuffer,
    FakeAudioContext,
    stubAudioContextGlobal,
} from "./fixtures/audioStubs";
import { assemblePerTrackGraph, type ResolvedTrackOutput } from "../perTrackGraph";
import { getBuiltinPresets } from "@/audio/presets";

const CLASSIC = getBuiltinPresets().find((preset) => preset.kind === "classic")!;

function output(
    trackIndex: number,
    seconds: number,
    plan: ResolvedTrackOutput["plan"],
    muted = false,
): ResolvedTrackOutput {
    return {
        trackIndex,
        buffer: new FakeAudioBuffer(2, Math.round(seconds * 44100), 44100) as unknown as AudioBuffer,
        plan,
        muted,
    };
}

describe("assemblePerTrackGraph", () => {
    it("routes preset tracks through chain.input with chain.output linked to master", () => {
        stubAudioContextGlobal();
        const ctx = new FakeAudioContext();
        const graph = assemblePerTrackGraph(
            ctx as unknown as BaseAudioContext,
            [output(0, 3, { kind: "preset", preset: CLASSIC })],
            0.8,
        );

        // One source per track, aimed at the chain INPUT (buffer feeds in).
        expect(graph.sources).toHaveLength(1);
        expect(graph.sources[0].destination).toBe(graph.chains[0].input);

        // The chain output must be linked into the master — a chain without a
        // downstream link is acoustically dead.
        const chainOutput = graph.chains[0].output;
        const chainOutputToMaster = ctx.connectLog.some(
            ([from, to]) => from === chainOutput && to === graph.master,
        );
        expect(chainOutputToMaster).toBe(true);
        expect(graph.master.gain.value).toBeCloseTo(0.8 * 0.4);
    });

    it("routes direct tracks straight into the master without a chain", () => {
        stubAudioContextGlobal();
        const ctx = new FakeAudioContext();
        const graph = assemblePerTrackGraph(
            ctx as unknown as BaseAudioContext,
            [output(0, 3, { kind: "direct" })],
            0.5,
        );
        expect(graph.chains).toHaveLength(0);
        expect(graph.sources).toHaveLength(1);
        expect(graph.sources[0].destination).toBe(graph.master);
    });

    it("skips muted tracks entirely (mute = silence, not bypass)", () => {
        stubAudioContextGlobal();
        const ctx = new FakeAudioContext();
        const graph = assemblePerTrackGraph(
            ctx as unknown as BaseAudioContext,
            [
                output(0, 3, { kind: "direct" }, true),
                output(1, 3, { kind: "direct" }),
            ],
            0.5,
        );
        expect(graph.mutedTrackIndexes).toEqual([0]);
        expect(graph.sources).toHaveLength(1);
        expect(graph.sources[0].trackIndex && graph.sources[0].destination).toBe(graph.master);
    });

    it("dispose disconnects the master and disposes chains", () => {
        stubAudioContextGlobal();
        const ctx = new FakeAudioContext();
        const graph = assemblePerTrackGraph(
            ctx as unknown as BaseAudioContext,
            [output(0, 3, { kind: "preset", preset: CLASSIC })],
            0.5,
        );
        const chain = graph.chains[0];
        const chainOutput = chain.output as unknown as { disconnectCalls: Array<unknown> };
        graph.dispose();
        expect(chainOutput.disconnectCalls.length).toBeGreaterThan(0);
        expect((graph.master as unknown as { disconnectCalls: Array<unknown> }).disconnectCalls.length).toBeGreaterThan(0);
    });
});
