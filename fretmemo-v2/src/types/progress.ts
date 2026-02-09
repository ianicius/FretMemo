export interface AccuracyStats {
    attempts: number;
    correct: number;
    avgResponseTime: number; // ms
    lastPracticed: number; // timestamp
}

export interface HeatMapData {
    // Key format: "string-fret" e.g., "5-0" for low E open string
    [positionKey: string]: AccuracyStats;
}

export interface StreakData {
    currentStreak: number;
    bestStreak: number;
    lastLoginDate: string; // ISO date YYYY-MM-DD
    freezeUsed: boolean;
}

export interface XPEvent {
    id: string;
    amount: number;
    reason: string;
    timestamp: number;
}

export interface UserProgress {
    level: number;
    currentXP: number;
    totalXP: number;
    xpHistory: XPEvent[];
    achievements: string[]; // IDs of unlocked achievements
}

export interface SessionStats {
    startTime: number;
    totalNotes: number;
    correctNotes: number;
    xpEarned: number;
    streakGained: number;
}
