import { useState, useMemo } from "react";
import { Key } from "tonal";
import { formatLocalizedNoteToken } from "@/lib/noteNotation";
import { useTranslation } from "react-i18next";
import { MAJOR_KEY_SIGNATURES } from "@/lib/improv/questions";
import { CircleDial } from "./CircleDial";
import { CIRCLE_CENTER, signatureLabel } from "./circleGeometry";

export default function CircleOfFifths({ initialKey }: { initialKey?: string } = {}) {
    const { t, i18n } = useTranslation();
    const language = i18n.resolvedLanguage ?? i18n.language;
    const [selectedKey, setSelectedKey] = useState<string>(initialKey ?? "C");

    const keyData = useMemo(() => {
        const major = Key.majorKey(selectedKey);
        return {
            name: `${formatLocalizedNoteToken(major.tonic, language)} ${t("theory.circle.major")}`,
            relativeName: `${formatLocalizedNoteToken(major.minorRelative, language)} ${t("theory.circle.minor")}`,
            scale: major.scale,
            chords: major.chords,
            chordsRoman: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
        };
    }, [selectedKey, t, language]);

    const keySignature = MAJOR_KEY_SIGNATURES.find((item) => item.key === selectedKey)?.list ?? [];

    return (
        <div className="space-y-5">
            {/* SVG Circle */}
            <div className="flex justify-center">
                <CircleDial selectedKey={selectedKey} onSelect={setSelectedKey}>
                    <text x={CIRCLE_CENTER} y={CIRCLE_CENTER - 8} textAnchor="middle" className="text-sm font-bold fill-primary">
                        {formatLocalizedNoteToken(selectedKey, language)}
                    </text>
                    <text x={CIRCLE_CENTER} y={CIRCLE_CENTER + 10} textAnchor="middle" className="text-[9px] fill-muted-foreground">
                        {keyData.relativeName}
                    </text>
                </CircleDial>
            </div>
            <p className="text-center text-xs text-muted-foreground">{t("theory.circle.countLegend")}</p>

            {/* Key info card */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h3 className="font-bold text-lg">{keyData.name}</h3>
                <p className="text-sm text-muted-foreground">
                    {t("theory.circle.relativeMinor")}: <span className="font-semibold text-foreground">{keyData.relativeName}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                    {t("theory.circle.keySignature")}:{" "}
                    <span className="font-semibold text-foreground">
                        {[signatureLabel(selectedKey), ...(keySignature.length ? ["—", keySignature.map((note) => formatLocalizedNoteToken(note, language)).join(", ")] : [])].join(" ")}
                    </span>
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
                                {formatLocalizedNoteToken(note, language)}
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
                                <span className="text-xs font-bold">{formatLocalizedNoteToken(chord, language)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
