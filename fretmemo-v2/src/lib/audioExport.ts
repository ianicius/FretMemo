/**
 * WAV export for rendered song audio (Your Songs "export audio", P2).
 *
 * Encodes an AudioBuffer as 16-bit PCM RIFF — no dependencies, no licensing
 * baggage (unlike MP3/LAME). Input is duck-typed so tests can pass plain
 * objects; real AudioBuffers satisfy the shape.
 */

interface AudioBufferLike {
    numberOfChannels: number;
    sampleRate: number;
    length: number;
    getChannelData(channel: number): Float32Array;
}

const FULL_SCALE = 32767;

function writeAscii(bytes: Uint8Array, offset: number, text: string): void {
    for (let i = 0; i < text.length; i += 1) {
        bytes[offset + i] = text.charCodeAt(i);
    }
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
    bytes[offset + 2] = (value >>> 16) & 0xff;
    bytes[offset + 3] = (value >>> 24) & 0xff;
}

function writeUint16(bytes: Uint8Array, offset: number, value: number): void {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >>> 8) & 0xff;
}

/** Encodes the buffer to 16-bit PCM WAV bytes (44-byte canonical header). */
export function buildWavBytes(buffer: AudioBufferLike): Uint8Array {
    const channels = buffer.numberOfChannels;
    const frames = buffer.length;
    const dataSize = frames * channels * 2;
    const bytes = new Uint8Array(44 + dataSize);

    writeAscii(bytes, 0, "RIFF");
    writeUint32(bytes, 4, 36 + dataSize);
    writeAscii(bytes, 8, "WAVE");
    writeAscii(bytes, 12, "fmt ");
    writeUint32(bytes, 16, 16); // fmt chunk size
    writeUint16(bytes, 20, 1); // PCM
    writeUint16(bytes, 22, channels);
    writeUint32(bytes, 24, buffer.sampleRate);
    writeUint32(bytes, 28, buffer.sampleRate * channels * 2); // byte rate
    writeUint16(bytes, 32, channels * 2); // block align
    writeUint16(bytes, 34, 16); // bits per sample
    writeAscii(bytes, 36, "data");
    writeUint32(bytes, 40, dataSize);

    const channelData: Float32Array[] = [];
    for (let channel = 0; channel < channels; channel += 1) {
        channelData.push(buffer.getChannelData(channel));
    }

    let offset = 44;
    for (let frame = 0; frame < frames; frame += 1) {
        for (let channel = 0; channel < channels; channel += 1) {
            const sample = Math.max(-1, Math.min(1, channelData[channel][frame]));
            const value = Math.round(sample * FULL_SCALE);
            bytes[offset] = value & 0xff;
            bytes[offset + 1] = (value >> 8) & 0xff;
            offset += 2;
        }
    }
    return bytes;
}

/** Encodes the buffer into a downloadable WAV Blob. */
export function audioBufferToWavBlob(buffer: AudioBufferLike): Blob {
    const bytes = buildWavBytes(buffer);
    // The encoder allocates an exact-size plain ArrayBuffer; the cast
    // satisfies TS 5.9 ArrayBuffer generics for BlobPart.
    return new Blob([bytes.buffer as ArrayBuffer], { type: "audio/wav" });
}
