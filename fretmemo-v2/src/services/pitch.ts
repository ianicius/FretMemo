import { useCallback, useEffect, useRef, useState } from "react";
import { NOTES } from "@/lib/constants";
import type { NoteName } from "@/types/fretboard";

function autoCorrelate(buffer: Float32Array, sampleRate: number): number | null {
  // Basic autocorrelation pitch detection (sufficient for guitar fundamentals)
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) {
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.01) return null;

  // Trim silence
  let start = 0;
  let end = buffer.length - 1;
  const threshold = 0.2;
  while (start < buffer.length / 2 && Math.abs(buffer[start]) < threshold) start++;
  while (end > buffer.length / 2 && Math.abs(buffer[end]) < threshold) end--;
  const trimmed = buffer.slice(start, end);
  if (trimmed.length < 2) return null;

  const size = trimmed.length;
  const correlations = new Float32Array(size);
  for (let lag = 0; lag < size; lag++) {
    let sum = 0;
    for (let i = 0; i < size - lag; i++) {
      sum += trimmed[i] * trimmed[i + lag];
    }
    correlations[lag] = sum;
  }

  // Find first dip
  let dip = 0;
  while (dip < size - 1 && correlations[dip] > correlations[dip + 1]) dip++;

  // Find max after dip
  let maxLag = dip;
  let maxVal = -Infinity;
  for (let lag = dip; lag < size; lag++) {
    const v = correlations[lag];
    if (v > maxVal) {
      maxVal = v;
      maxLag = lag;
    }
  }
  if (maxLag <= 0) return null;

  // Parabolic interpolation for better accuracy
  let refinedLag = maxLag;
  if (maxLag > 0 && maxLag < size - 1) {
    const x1 = correlations[maxLag - 1];
    const x2 = correlations[maxLag];
    const x3 = correlations[maxLag + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a !== 0) refinedLag = maxLag - b / (2 * a);
  }

  const frequency = sampleRate / refinedLag;
  if (!Number.isFinite(frequency)) return null;
  return frequency;
}

function noteFromFrequency(freq: number): NoteName {
  const midi = Math.round(12 * Math.log2(freq / 440) + 69);
  const index = ((midi % 12) + 12) % 12;
  return NOTES[index];
}

interface UsePitchDetectorOptions {
  minHz?: number;
  maxHz?: number;
  stableFrames?: number;
}

export function usePitchDetector(enabled: boolean, opts: UsePitchDetectorOptions = {}) {
  const { minHz = 70, maxHz = 1200, stableFrames = 3 } = opts;

  const [note, setNote] = useState<NoteName | null>(null);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const stableRef = useRef<{ note: NoteName | null; count: number }>({ note: null, count: 0 });

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    analyserRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    stableRef.current = { note: null, count: 0 };
    setIsRunning(false);
    setFrequency(null);
    setNote(null);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone input is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error("AudioContext is not available in this environment.");
      }

      const audioContext = new AudioContextCtor();
      audioContextRef.current = audioContext;
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsRunning(true);

      const buffer = new Float32Array(analyser.fftSize);
      const tick = () => {
        const ctx = audioContextRef.current;
        const node = analyserRef.current;
        if (!ctx || !node) return;

        node.getFloatTimeDomainData(buffer);
        const freq = autoCorrelate(buffer, ctx.sampleRate);
        if (freq && freq >= minHz && freq <= maxHz) {
          const nextNote = noteFromFrequency(freq);

          const prev = stableRef.current.note;
          if (prev === nextNote) {
            stableRef.current.count += 1;
          } else {
            stableRef.current = { note: nextNote, count: 1 };
          }

          if (stableRef.current.count >= stableFrames) {
            setFrequency(freq);
            setNote(nextNote);
          }
        } else {
          stableRef.current = { note: null, count: 0 };
          setFrequency(null);
          setNote(null);
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      tick();
    } catch {
      stop();
      setError("Microphone access denied. Allow mic permission to use pitch detection.");
    }
  }, [maxHz, minHz, stableFrames, stop]);

  useEffect(() => {
    if (!enabled) return;
    void start();
    return () => stop();
  }, [enabled, start, stop]);

  return { note, frequency, error, isRunning };
}
