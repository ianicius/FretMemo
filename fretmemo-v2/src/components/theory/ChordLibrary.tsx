import { useState, useMemo } from "react";
import { Chord, Note } from "tonal";
import { cn } from "@/lib/utils";
import { playChord } from "@/lib/audio";

const ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const QUALITY_GROUPS = [
    { label: "Triads", types: ["major", "minor", "dim", "aug"] },
    { label: "7ths", types: ["7", "maj7", "m7", "m7b5", "dim7"] },
    { label: "Sus / Add", types: ["sus2", "sus4", "add9", "madd9"] },
    { label: "Extended", types: ["9", "m9", "maj9", "11", "13"] },
];

function normalizeNote(n: string): string {
    return Note.simplify(n) ?? n;
}

// Common guitar voicings (open chords and barre shapes)
// Each voicing: [string6, string5, string4, string3, string2, string1]
// -1 = muted, 0 = open
const COMMON_VOICINGS: Record<string, number[][]> = {
    C: [[0, 3, 2, 0, 1, 0], [-1, 3, 5, 5, 5, 3]],
    Cm: [[-1, 3, 5, 5, 4, 3]],
    D: [[-1, -1, 0, 2, 3, 2]],
    Dm: [[-1, -1, 0, 2, 3, 1]],
    E: [[0, 2, 2, 1, 0, 0]],
    Em: [[0, 2, 2, 0, 0, 0]],
    F: [[1, 3, 3, 2, 1, 1], [-1, -1, 3, 2, 1, 1]],
    G: [[3, 2, 0, 0, 0, 3], [3, 2, 0, 0, 3, 3]],
    A: [[-1, 0, 2, 2, 2, 0]],
    Am: [[-1, 0, 2, 2, 1, 0]],
    B: [[-1, 2, 4, 4, 4, 2]],
    Bm: [[-1, 2, 4, 4, 3, 2]],
};

function ChordDiagram({ frets, label }: { frets: number[]; root: string; label: string }) {
    const W = 120;
    const H = 140;
    const stringSpacing = 18;
    const fretSpacing = 22;
    const startX = 18;
    const startY = 28;
    const numFrets = 5;

    const minFret = Math.min(...frets.filter(f => f > 0));
    const maxFret = Math.max(...frets.filter(f => f > 0));
    const useOffset = maxFret > 5;
    const offset = useOffset ? minFret - 1 : 0;

    const midiValues = frets.map((fret, i) => {
        if (fret === -1) return null;
        const openMidis = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4
        return openMidis[i] + fret;
    }).filter((m): m is number => m !== null);

    return (
        <div className="flex flex-col items-center">
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="text-foreground">
                {/* Nut or position marker */}
                {!useOffset ? (
                    <rect x={startX - 1} y={startY - 2} width={stringSpacing * 5 + 2} height={3} fill="currentColor" />
                ) : (
                    <text x={startX - 14} y={startY + fretSpacing / 2 + 4} fontSize="9" fill="currentColor" textAnchor="middle">{offset + 1}</text>
                )}

                {/* Frets */}
                {Array.from({ length: numFrets + 1 }, (_, i) => (
                    <line key={i} x1={startX} y1={startY + i * fretSpacing} x2={startX + stringSpacing * 5} y2={startY + i * fretSpacing} stroke="currentColor" strokeWidth={0.5} strokeOpacity={0.3} />
                ))}

                {/* Strings */}
                {Array.from({ length: 6 }, (_, i) => (
                    <line key={i} x1={startX + i * stringSpacing} y1={startY} x2={startX + i * stringSpacing} y2={startY + numFrets * fretSpacing} stroke="currentColor" strokeWidth={0.8} strokeOpacity={0.4} />
                ))}

                {/* Finger positions */}
                {frets.map((fret, i) => {
                    const x = startX + i * stringSpacing;
                    if (fret === -1) {
                        return <text key={i} x={x} y={startY - 6} fontSize="10" textAnchor="middle" fill="currentColor" opacity={0.5}>✕</text>;
                    }
                    if (fret === 0) {
                        return <circle key={i} cx={x} cy={startY - 7} r={4} fill="none" stroke="currentColor" strokeWidth={1.5} />;
                    }
                    const displayFret = fret - offset;
                    const y = startY + (displayFret - 0.5) * fretSpacing;
                    return <circle key={i} cx={x} cy={y} r={6} fill="hsl(var(--primary))" />;
                })}
            </svg>

            <button
                className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition"
                onClick={() => playChord(midiValues, 1.2)}
                title="Play chord"
            >
                🔊 {label}
            </button>
        </div>
    );
}

export default function ChordLibrary() {
    const [root, setRoot] = useState("C");
    const [selectedType, setSelectedType] = useState("major");

    const chordName = `${root}${selectedType === "major" ? "" : selectedType}`;
    const chordData = Chord.get(chordName);

    const chordNotes = useMemo(() => {
        if (!chordData.notes.length) return [];
        return chordData.notes.map(normalizeNote);
    }, [chordData.notes]);

    const voicings = COMMON_VOICINGS[chordName] ?? COMMON_VOICINGS[`${root}${selectedType === "minor" ? "m" : ""}`] ?? [];

    return (
        <div className="space-y-5">
            {/* Root selector */}
            <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Root Note</label>
                <div className="flex flex-wrap gap-1.5">
                    {ROOTS.map((n) => (
                        <button
                            key={n}
                            onClick={() => setRoot(n)}
                            className={cn(
                                "h-9 min-w-[36px] px-2 rounded-lg border text-sm font-bold transition",
                                n === root
                                    ? "bg-primary/10 border-primary text-primary"
                                    : "bg-card border-border text-muted-foreground hover:border-primary/50"
                            )}
                        >
                            {n}
                        </button>
                    ))}
                </div>
            </div>

            {/* Quality selector */}
            {QUALITY_GROUPS.map((group) => (
                <div key={group.label}>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">{group.label}</label>
                    <div className="flex flex-wrap gap-1.5">
                        {group.types.map((t) => {
                            const name = `${root}${t === "major" ? "" : t}`;
                            const data = Chord.get(name);
                            const valid = data.notes.length > 0;
                            return (
                                <button
                                    key={t}
                                    disabled={!valid}
                                    onClick={() => setSelectedType(t)}
                                    className={cn(
                                        "h-9 px-3 rounded-lg border text-sm font-bold transition",
                                        t === selectedType
                                            ? "bg-primary/10 border-primary text-primary"
                                            : "bg-card border-border text-muted-foreground hover:border-primary/50",
                                        !valid && "opacity-30 cursor-not-allowed"
                                    )}
                                >
                                    {t === "major" ? "maj" : t}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Chord info */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <h3 className="text-lg font-bold">{chordName}</h3>
                {chordNotes.length > 0 ? (
                    <>
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">Notes:</span>
                            <div className="flex gap-1">
                                {chordNotes.map((n, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-primary/10 rounded-md text-xs font-bold">{n}</span>
                                ))}
                            </div>
                        </div>
                        {chordData.intervals.length > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Intervals:</span>
                                <span className="text-xs font-mono">{chordData.intervals.join(" – ")}</span>
                            </div>
                        )}
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground">Chord not found in library.</p>
                )}
            </div>

            {/* Voicings */}
            {voicings.length > 0 && (
                <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Voicings</label>
                    <div className="flex flex-wrap gap-4">
                        {voicings.map((v, i) => (
                            <ChordDiagram key={i} frets={v} root={root} label={`Voicing ${i + 1}`} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
