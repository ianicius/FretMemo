/**
 * Identity of every learning track: id, roadmap path and search-engine text.
 * Kept free of curriculum imports so the app shell (SeoManager) can read it
 * without pulling the lesson data into the main bundle. The full registry in
 * tracks.ts builds on these entries.
 */

export interface TrackMeta {
    /** Also the last path segment of the roadmap, except for the default track. */
    id: string;
    /** Roadmap path. Module pages live at `/improv/<moduleId>` for every track. */
    path: string;
    /** Page title and description of the roadmap (English, like the rest of SeoManager). */
    seo: { title: string; description: string };
}

export const TRACK_META = {
    improv: {
        id: "improv",
        path: "/improv",
        seo: {
            title: "Guitar Improv Training Roadmap | FretMemo",
            description: "Learn guitar improvisation step by step with a 22-module roadmap covering scales, modes, arpeggios, chord tones, and backing-track practice.",
        },
    },
    voicings: {
        id: "voicings",
        path: "/improv/voicings",
        seo: {
            title: "Guitar Triads & Voice Leading Roadmap | FretMemo",
            description: "Learn guitar triads in 12 modules: inversions on every string set, the whole fretboard map, voice leading through real progressions, and triads in your solos.",
        },
    },
    blues: {
        id: "blues",
        path: "/improv/blues",
        seo: {
            title: "Blues Guitar Roadmap | FretMemo",
            description: "Learn blues guitar in 14 modules: the 12-bar form, shuffle rhythm, string bends with pitch feedback, licks, phrasing, and playing the changes over backing tracks.",
        },
    },
} satisfies Record<string, TrackMeta>;

export const TRACK_META_LIST: TrackMeta[] = Object.values(TRACK_META);
