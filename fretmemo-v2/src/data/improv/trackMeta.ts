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
    sevenths: {
        id: "sevenths",
        path: "/improv/sevenths",
        seo: {
            title: "Seventh Chords & Comping Roadmap | FretMemo",
            description: "Learn seventh chords and comping in 12 modules: shell voicings, drop 2 and drop 3 on every string set, guide tones, and comping real progressions over swing and bossa backing tracks.",
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
    ear: {
        id: "ear",
        path: "/improv/ear",
        seo: {
            title: "Ear Training Roadmap for Guitarists | FretMemo",
            description: "Train your ear in 12 modules: scale degrees after a cadence, intervals, chord qualities and inversions, chord functions and progressions, then play back what you hear on the guitar.",
        },
    },
} satisfies Record<string, TrackMeta>;

export const TRACK_META_LIST: TrackMeta[] = Object.values(TRACK_META);
