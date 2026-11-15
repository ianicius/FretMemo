import { MAJOR_KEY_SIGNATURES } from "@/lib/improv/questions";

export const CIRCLE_KEYS = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"] as const;
export const CIRCLE_CENTER = 180;

/** "4♭", "2♯" or "0": how many accidentals the major key signature has. */
export function signatureLabel(key: string) {
    const signature = MAJOR_KEY_SIGNATURES.find((item) => item.key === key);
    if (!signature || signature.count === 0) return "0";
    return `${signature.count}${signature.type === "sharps" ? "♯" : "♭"}`;
}
