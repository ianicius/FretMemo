import type { Achievement, PositionStats, SessionRecord } from '@/stores/useProgressStore';

export interface ProgressSnapshotSource {
    positionStats: Record<string, PositionStats>;
    heatMapEnabled: boolean;
    totalPracticeTime: number;
    streakDays: number;
    streakFreezes: number;
    lastFreezeDate: string | null;
    lastPracticeDate: string | null;
    totalCorrect: number;
    totalIncorrect: number;
    sessionHistory: SessionRecord[];
    achievements: Achievement[];
}

export interface ProgressExportPayload {
    app: 'FretMemo';
    schemaVersion: 1;
    exportedAt: string;
    progress: ProgressSnapshotSource;
}

export function createProgressExportPayload(
    source: ProgressSnapshotSource,
    exportedAt: Date = new Date()
): ProgressExportPayload {
    return {
        app: 'FretMemo',
        schemaVersion: 1,
        exportedAt: exportedAt.toISOString(),
        progress: {
            positionStats: source.positionStats,
            heatMapEnabled: source.heatMapEnabled,
            totalPracticeTime: source.totalPracticeTime,
            streakDays: source.streakDays,
            streakFreezes: source.streakFreezes,
            lastFreezeDate: source.lastFreezeDate,
            lastPracticeDate: source.lastPracticeDate,
            totalCorrect: source.totalCorrect,
            totalIncorrect: source.totalIncorrect,
            sessionHistory: source.sessionHistory,
            achievements: source.achievements,
        },
    };
}

export function getProgressExportFilename(date: Date = new Date()): string {
    const timestamp = date.toISOString().replace(/[:.]/g, '-');
    return `fretmemo-progress-${timestamp}.json`;
}

export function downloadProgressExport(source: ProgressSnapshotSource): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        throw new Error('Download is only available in browser environments.');
    }

    const now = new Date();
    const payload = createProgressExportPayload(source, now);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');

    downloadLink.href = url;
    downloadLink.download = getProgressExportFilename(now);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.URL.revokeObjectURL(url);
}

export async function parseJsonFile(file: File): Promise<unknown> {
    const raw = await file.text();
    return JSON.parse(raw);
}
