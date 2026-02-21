import { useState, useMemo, useCallback } from "react";
import { Key } from "tonal";
import { applyPolishNotation } from "@/lib/noteNotation";
import { useTranslation } from "react-i18next";

const KEYS = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"] as const;
const RADIUS = 140;
const INNER_RADIUS = 100;
const CENTER = 180;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default function CircleOfFifths() {
    const { t } = useTranslation();
    const [selectedKey, setSelectedKey] = useState<string>("C");

    const keyData = useMemo(() => {
        const major = Key.majorKey(selectedKey);
        return {
            name: `${applyPolishNotation(major.tonic)} ${t("theory.circle.major")}`,
            relativeName: `${applyPolishNotation(major.minorRelative)} ${t("theory.circle.minor")}`,
            scale: major.scale,
            chords: major.chords,
            chordsRoman: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
        };
    }, [selectedKey, t]);

    const segments = useMemo(() => {
        return KEYS.map((key, i) => {
            const angle = (i * 360) / 12;
            const outerPos = polarToCartesian(CENTER, CENTER, RADIUS, angle);
            const innerPos = polarToCartesian(CENTER, CENTER, INNER_RADIUS, angle);
            const minorKey = Key.majorKey(key).minorRelative;
            return { key, minorKey, angle, outerPos, innerPos };
        });
    }, []);

    const handleKeyClick = useCallback((key: string) => {
        setSelectedKey(key);
    }, []);

    return (
        <div className="space-y-5">
            {/* SVG Circle */}
            <div className="flex justify-center">
                <svg
                    viewBox="0 0 360 360"
                    className="w-full max-w-[360px] select-none"
                    role="img"
                    aria-label={t("theory.page.tools.circleOfFifths")}
                >
                    {/* Background circle */}
                    <circle cx={CENTER} cy={CENTER} r={RADIUS + 20} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={1} />
                    <circle cx={CENTER} cy={CENTER} r={INNER_RADIUS - 10} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={1} />

                    {/* Key segments */}
                    {segments.map((seg) => {
                        const isSelected = seg.key === selectedKey;
                        return (
                            <g key={seg.key} className="cursor-pointer" onClick={() => handleKeyClick(seg.key)}>
                                {/* Selection highlight */}
                                {isSelected && (
                                    <circle
                                        cx={seg.outerPos.x}
                                        cy={seg.outerPos.y}
                                        r={22}
                                        className="fill-primary/20 stroke-primary"
                                        strokeWidth={2}
                                    />
                                )}
                                {/* Major key label (outer) */}
                                <text
                                    x={seg.outerPos.x}
                                    y={seg.outerPos.y}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    className={`text-sm font-bold select-none ${isSelected ? "fill-primary" : "fill-foreground"
                                        }`}
                                >
                                    {applyPolishNotation(seg.key)}
                                </text>
                                {/* Minor key label (inner) */}
                                <text
                                    x={seg.innerPos.x}
                                    y={seg.innerPos.y}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    className={`text-[10px] select-none ${isSelected ? "fill-primary/70" : "fill-muted-foreground"
                                        }`}
                                >
                                    {applyPolishNotation(seg.minorKey)}m
                                </text>
                            </g>
                        );
                    })}

                    {/* Center label */}
                    <text x={CENTER} y={CENTER - 8} textAnchor="middle" className="text-sm font-bold fill-primary">
                        {applyPolishNotation(selectedKey)}
                    </text>
                    <text x={CENTER} y={CENTER + 10} textAnchor="middle" className="text-[9px] fill-muted-foreground">
                        {keyData.relativeName}
                    </text>
                </svg>
            </div>

            {/* Key info card */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h3 className="font-bold text-lg">{keyData.name}</h3>
                <p className="text-sm text-muted-foreground">
                    {t("theory.circle.relativeMinor")}: <span className="font-semibold text-foreground">{keyData.relativeName}</span>
                </p>

                {/* Scale notes */}
                <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("theory.circle.scaleNotes")}</p>
                    <div className="flex flex-wrap gap-2">
                        {keyData.scale.map((note, i) => (
                            <span
                                key={note}
                                className={`px-2.5 py-1 rounded-full text-xs font-bold ${i === 0
                                        ? "bg-red-500 text-white"
                                        : "bg-primary/10 text-primary border border-primary/20"
                                    }`}
                            >
                                {applyPolishNotation(note)}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Diatonic chords */}
                <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("theory.circle.diatonicChords")}</p>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                        {keyData.chords.map((chord, i) => (
                            <div
                                key={chord}
                                className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-muted/30 p-2"
                            >
                                <span className="text-[10px] font-bold text-muted-foreground">{keyData.chordsRoman[i]}</span>
                                <span className="text-xs font-bold">{applyPolishNotation(chord)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
