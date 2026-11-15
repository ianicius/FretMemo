import { Note } from "tonal";
import { MAJOR_KEY_SIGNATURES } from "@/lib/improv/questions";

export const CIRCLE_KEYS = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"] as const;
export const CIRCLE_CENTER = 180;

/** Circle position of any note or chord token ("Gb7" → "F#", "Dm7" → "D"), matched by pitch. */
export function circleKeyOf(token: string | undefined): string | undefined {
    const root = /[A-G][#b]?/.exec((token ?? "").replace(/^circle:/, ""))?.[0];
    if (!root) return undefined;
    return CIRCLE_KEYS.find((key) => Note.chroma(key) === Note.chroma(root));
}

/** "4♭", "2♯" or "0": how many accidentals the major key signature has. */
export function signatureLabel(key: string) {
    const signature = MAJOR_KEY_SIGNATURES.find((item) => item.key === key);
    if (!signature || signature.count === 0) return "0";
    return `${signature.count}${signature.type === "sharps" ? "♯" : "♭"}`;
}
