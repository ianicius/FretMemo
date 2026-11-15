import { useState, type ReactNode } from "react";
import { Key } from "tonal";
import { useTranslation } from "react-i18next";
import { formatLocalizedNoteToken } from "@/lib/noteNotation";
import { CIRCLE_CENTER, CIRCLE_KEYS, signatureLabel } from "./circleGeometry";
import { cn } from "@/lib/utils";

const RADIUS = 140;
const INNER_RADIUS = 100;
const DIM_RADIUS = 68;
const FRAME_OUTER = 164;
const FRAME_INNER = 84;
const FRAME_NOTCH = 54;

function polar(r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: CIRCLE_CENTER + r * Math.cos(rad), y: CIRCLE_CENTER + r * Math.sin(rad) };
}

const SEGMENTS = CIRCLE_KEYS.map((key, i) => {
    const angle = (i * 360) / 12;
    return {
        key,
        minorKey: Key.majorKey(key).minorRelative,
        outerPos: polar(RADIUS, angle),
        innerPos: polar(INNER_RADIUS, angle),
        countPos: polar(RADIUS + 30, angle),
        // vii° of this key: the seventh scale note (C major → B°).
        dimRoot: Key.majorKey(key).scale[6],
        dimPos: polar(DIM_RADIUS, angle),
        countLabel: signatureLabel(key),
    };
});

/**
 * Outline around the seven diatonic chords of the key at 12 o'clock:
 * IV–I–V (outer ring), ii–vi–iii (minor ring) and vii° (inner ring).
 * Their roots are exactly the seven notes of the key.
 */
const FRAME_PATH = (() => {
    const at = (r: number, angle: number) => { const p = polar(r, angle); return `${p.x.toFixed(1)} ${p.y.toFixed(1)}`; };
    const arc = (r: number, angle: number, sweep: 0 | 1) => `A ${r} ${r} 0 0 ${sweep} ${at(r, angle)}`;
    return [
        `M ${at(FRAME_OUTER, -45)}`, arc(FRAME_OUTER, 45, 1),
        `L ${at(FRAME_INNER, 45)}`, arc(FRAME_INNER, 15, 0),
        `L ${at(FRAME_NOTCH, 15)}`, arc(FRAME_NOTCH, -15, 0),
        `L ${at(FRAME_INNER, -15)}`, arc(FRAME_INNER, -45, 0), "Z",
    ].join(" ");
})();

interface CircleDialProps {
    selectedKey?: string;
    /** Makes every key a button. */
    onSelect?: (key: string) => void;
    showCounts?: boolean;
    showMinors?: boolean;
    /** Answer feedback per key; wins over the selection highlight. */
    statusByKey?: Record<string, "correct" | "incorrect">;
    /** SVG content for the middle of the circle. */
    children?: ReactNode;
}

/** The circle of fifths drawing, shared by the theory tool and the key-signature quiz. */
export function CircleDial({ selectedKey, onSelect, showCounts = true, showMinors = true, statusByKey, children }: CircleDialProps) {
    const { t, i18n } = useTranslation();
    const language = i18n.resolvedLanguage ?? i18n.language;

    // The frame turns the short way round: `turn` accumulates degrees instead of snapping to 0–330.
    const selectedIndex = selectedKey ? (CIRCLE_KEYS as readonly string[]).indexOf(selectedKey) : -1;
    const [turn, setTurn] = useState(Math.max(selectedIndex, 0) * 30);
    const delta = selectedIndex < 0 ? 0 : ((selectedIndex * 30 - turn) % 360 + 540) % 360 - 180;
    if (delta !== 0) setTurn(turn + delta);
    const showFrame = showMinors && selectedIndex >= 0;

    return (
        <svg
            viewBox="0 0 360 360"
            className="w-full max-w-[360px] select-none"
            role={onSelect ? "group" : "img"}
            aria-label={t("theory.page.tools.circleOfFifths")}
        >
            <circle cx={CIRCLE_CENTER} cy={CIRCLE_CENTER} r={RADIUS + 20} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={1} />
            <circle cx={CIRCLE_CENTER} cy={CIRCLE_CENTER} r={FRAME_INNER} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={1} />

            {showFrame && (
                <path
                    d={FRAME_PATH}
                    className="pointer-events-none fill-primary/10 stroke-primary transition-transform duration-500 ease-out motion-reduce:transition-none"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    style={{ transform: `rotate(${turn}deg)`, transformOrigin: `${CIRCLE_CENTER}px ${CIRCLE_CENTER}px` }}
                    data-circle-frame={selectedKey}
                />
            )}

            {SEGMENTS.map((seg) => {
                const status = statusByKey?.[seg.key];
                const isSelected = seg.key === selectedKey;
                const keyName = formatLocalizedNoteToken(seg.key, language);
                return (
                    <g
                        key={seg.key}
                        className={cn("outline-none", onSelect && "cursor-pointer [&:focus-visible>circle]:stroke-primary")}
                        onClick={() => onSelect?.(seg.key)}
                        onKeyDown={(event) => {
                            if (!onSelect || (event.key !== "Enter" && event.key !== " ")) return;
                            event.preventDefault();
                            onSelect(seg.key);
                        }}
                        role={onSelect ? "button" : undefined}
                        tabIndex={onSelect ? 0 : undefined}
                        aria-label={onSelect ? `${keyName} ${t("theory.circle.major")}` : undefined}
                        data-circle-key={seg.key}
                        data-status={status}
                    >
                        {/* Hit area; doubles as the selection / feedback highlight. */}
                        <circle
                            cx={seg.outerPos.x}
                            cy={seg.outerPos.y}
                            r={22}
                            strokeWidth={2}
                            className={cn(
                                "fill-transparent stroke-transparent",
                                isSelected && "fill-primary/20 stroke-primary",
                                status === "correct" && "fill-emerald-500/20 stroke-emerald-500",
                                status === "incorrect" && "fill-rose-500/20 stroke-rose-500",
                            )}
                        />
                        {showCounts && (
                            <text
                                x={seg.countPos.x}
                                y={seg.countPos.y}
                                textAnchor="middle"
                                dominantBaseline="central"
                                className={cn("text-[10px] font-semibold select-none", isSelected ? "fill-primary" : "fill-muted-foreground")}
                            >
                                {seg.countLabel}
                            </text>
                        )}
                        <text
                            x={seg.outerPos.x}
                            y={seg.outerPos.y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className={cn("text-sm font-bold select-none", isSelected && !status ? "fill-primary" : "fill-foreground")}
                        >
                            {keyName}
                        </text>
                        {showMinors && (
                            <text
                                x={seg.innerPos.x}
                                y={seg.innerPos.y}
                                textAnchor="middle"
                                dominantBaseline="central"
                                className={cn("text-[10px] select-none", isSelected ? "fill-primary/70" : "fill-muted-foreground")}
                            >
                                {formatLocalizedNoteToken(seg.minorKey, language)}m
                            </text>
                        )}
                        {showMinors && (
                            <text
                                x={seg.dimPos.x}
                                y={seg.dimPos.y}
                                textAnchor="middle"
                                dominantBaseline="central"
                                className={cn("text-[9px] select-none", isSelected ? "fill-primary/70" : "fill-muted-foreground")}
                            >
                                {formatLocalizedNoteToken(seg.dimRoot, language)}°
                            </text>
                        )}
                    </g>
                );
            })}
            {children}
        </svg>
    );
}
