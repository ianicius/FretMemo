import { describe, expect, it } from "vitest";
import { audioBufferToWavBlob, buildWavBytes } from "../audioExport";

/** Minimal AudioBuffer duck-type for deterministic byte-level tests. */
function fakeBuffer(channels: Float32Array[], sampleRate: number) {
    return {
        numberOfChannels: channels.length,
        sampleRate,
        length: channels[0].length,
        getChannelData: (index: number) => channels[index],
    };
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
    return String.fromCharCode(...bytes.slice(offset, offset + length));
}

describe("audioExport — buildWavBytes", () => {
    it("writes a 16-bit PCM RIFF header for mono input", () => {
        const data = fakeBuffer([new Float32Array([0, 0.5, -0.5, 1])], 44100);
        const bytes = buildWavBytes(data as unknown as AudioBuffer);

        expect(readAscii(bytes, 0, 4)).toBe("RIFF");
        // Total size minus the first 8 bytes.
        expect(bytes.length - 8).toBe((bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)) >>> 0);
        expect(readAscii(bytes, 8, 4)).toBe("WAVE");
        expect(readAscii(bytes, 12, 4)).toBe("fmt ");
        expect(readAscii(bytes, 36, 4)).toBe("data");
        // PCM = 1, mono = 1 channel, sample rate matches.
        expect(bytes[20]).toBe(1);
        expect(bytes[22]).toBe(1);
        const sampleRate =
            bytes[24] | (bytes[25] << 8) | (bytes[26] << 16) | (bytes[27] << 24);
        expect(sampleRate).toBe(44100);
        // Byte rate = sampleRate * channels * 2.
        const byteRate =
            bytes[28] | (bytes[29] << 8) | (bytes[30] << 16) | (bytes[31] << 24);
        expect(byteRate).toBe(44100 * 2);
        // 4 samples * 2 bytes.
        const dataSize =
            bytes[40] | (bytes[41] << 8) | (bytes[42] << 16) | (bytes[43] << 24);
        expect(dataSize).toBe(8);
        expect(bytes.length).toBe(44 + 8);
    });

    it("encodes samples little-endian with clamping", () => {
        // Full scale is ±32767 (symmetric — avoids the 16-bit overflow
        // asymmetry at -32768): 1.5 clamps to +32767, -2 to -32767.
        const data = fakeBuffer([new Float32Array([1.5, -2, 0.5])], 22050);
        const bytes = buildWavBytes(data as unknown as AudioBuffer);

        // Read as SIGNED 16-bit little-endian.
        const read = (offset: number) => {
            const unsigned = bytes[offset] | (bytes[offset + 1] << 8);
            return unsigned >= 0x8000 ? unsigned - 0x10000 : unsigned;
        };
        expect(read(44)).toBe(32767);
        expect(read(46)).toBe(-32767);
        expect(read(48)).toBe(Math.round(0.5 * 32767));
    });

    it("interleaves stereo channels", () => {
        const data = fakeBuffer(
            [new Float32Array([0.1, 0.2]), new Float32Array([0.3, 0.4])],
            8000,
        );
        const bytes = buildWavBytes(data as unknown as AudioBuffer);

        // fmt chunk: 2 channels.
        expect(bytes[22]).toBe(2);
        // Frame order: L0, R0, L1, R1.
        const s = (offset: number) => bytes[offset] | (bytes[offset + 1] << 8);
        expect(s(44)).toBe(Math.round(0.1 * 32767));
        expect(s(46)).toBe(Math.round(0.3 * 32767));
        expect(s(48)).toBe(Math.round(0.2 * 32767));
        expect(s(50)).toBe(Math.round(0.4 * 32767));
    });
});

describe("audioExport — audioBufferToWavBlob", () => {
    it("returns a wav-typed Blob carrying the RIFF bytes", async () => {
        const data = fakeBuffer([new Float32Array([0, 0])], 44100);
        const blob = audioBufferToWavBlob(data as unknown as AudioBuffer);
        expect(blob.type).toBe("audio/wav");
        expect(blob.size).toBe(44 + 4);
    });
});
