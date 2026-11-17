/**
 * Registry of learning tracks. A track is an ordered list of modules built
 * from the shared exercise engines, shown as its own roadmap. Adding a track
 * means: a data file with its modules, an entry in trackMeta.ts, one entry
 * here, its translations (`improv.tracks.<id>`, `improv.modules.<moduleId>`,
 * `improv.ex.<exerciseId>`) and its routes in app-route-entrypoints.json.
 * The roadmap, module view, progress store, daily session, unlock rules,
 * home card and progress page all read this list.
 */

import { CURRICULUM, STANDARDS, STANDARDS_ID, type ImprovExercise, type ImprovModule } from "./curriculum";
import { BLUES_CURRICULUM, BLUES_JAM, BLUES_JAM_ID } from "./blues";
import { TRIADS_CURRICULUM } from "./triads";
import { TRACK_META, type TrackMeta } from "./trackMeta";

export interface Track extends TrackMeta {
    modules: ImprovModule[];
    /** Display stages over the module order (headings on the roadmap). */
    stages: Array<{ labelKey: string; from: number; to: number }>;
    /** A free-play exercise under the roadmap; its progress is stored under `id` and gates nothing. */
    extra?: { id: string; titleKey: string; exercise: ImprovExercise };
    /** Offer the placement quiz (one question per module quiz) on the roadmap. */
    entranceTest?: boolean;
}

export const TRACKS: Track[] = [
    {
        ...TRACK_META.improv,
        modules: CURRICULUM,
        stages: [
            { labelKey: "improv.stage.podstawy", from: 1, to: 6 },
            { labelKey: "improv.stage.harmonia", from: 7, to: 11 },
            { labelKey: "improv.stage.granie", from: 12, to: 17 },
            { labelKey: "improv.stage.zaawansowane", from: 18, to: 22 },
        ],
        extra: { id: STANDARDS_ID, titleKey: "improv.standards.title", exercise: STANDARDS },
        entranceTest: true,
    },
    {
        ...TRACK_META.blues,
        modules: BLUES_CURRICULUM,
        stages: [
            { labelKey: "improv.tracks.blues.stages.rhythm", from: 1, to: 3 },
            { labelKey: "improv.tracks.blues.stages.language", from: 4, to: 7 },
            { labelKey: "improv.tracks.blues.stages.colours", from: 8, to: 10 },
            { labelKey: "improv.tracks.blues.stages.changes", from: 11, to: 14 },
        ],
        extra: { id: BLUES_JAM_ID, titleKey: "improv.tracks.blues.extraTitle", exercise: BLUES_JAM },
    },
    {
        ...TRACK_META.voicings,
        modules: TRIADS_CURRICULUM,
        stages: [
            { labelKey: "improv.tracks.voicings.stages.build", from: 1, to: 3 },
            { labelKey: "improv.tracks.voicings.stages.map", from: 4, to: 7 },
            { labelKey: "improv.tracks.voicings.stages.leading", from: 8, to: 10 },
            { labelKey: "improv.tracks.voicings.stages.melody", from: 11, to: 12 },
        ],
    },
];

export const DEFAULT_TRACK = TRACKS[0] as Track;

export const ALL_MODULES: ImprovModule[] = TRACKS.flatMap((track) => track.modules);

/** Ids that may hold progress without being a module (the tracks' free-play exercises). */
const EXTRA_IDS = new Set(TRACKS.flatMap((track) => (track.extra ? [track.extra.id] : [])));

export function isExtraProgressId(id: string): boolean {
    return EXTRA_IDS.has(id);
}

export function getTrack(trackId: string | null | undefined): Track | undefined {
    return TRACKS.find((track) => track.id === trackId);
}

/** A module of any track. */
export function getModule(moduleId: string | undefined): ImprovModule | undefined {
    return moduleId ? ALL_MODULES.find((module) => module.id === moduleId) : undefined;
}

/** The track a module belongs to (the default track for unknown ids). */
export function trackOfModule(moduleId: string): Track {
    return TRACKS.find((track) => track.modules.some((module) => module.id === moduleId)) ?? DEFAULT_TRACK;
}
