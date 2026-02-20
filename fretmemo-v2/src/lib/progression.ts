/**
 * Gamification & Progression Mechanics
 *
 * Handles exponential leveling curves, dynamic XP multipliers,
 * and streak bonuses to encourage retention and stickiness.
 */

// --- Constants & Config --- //

// Leveling Curve: Level = floor((XP / Base)^1/Factor) + 1
const BASE_XP = 100;
const GROWTH_FACTOR = 1.5;

// Base XP awarded for a standard correct action
const BASE_CORRECT_XP = 10;

// Maximum expected BPM for scaling multiplier
const MAX_SCALING_BPM = 200;

// Streak Multipliers
const STREAK_MILESTONES = {
    7: 1.2,    // 7+ days: 1.2x XP
    14: 1.35,  // 14+ days: 1.35x XP
    30: 1.5,   // 30+ days: 1.5x XP
};

// --- Math Utilities --- //

/**
 * Calculates the user's level based on total XP using an exponential growth curve.
 * This makes early levels fast and higher levels prestigious.
 */
export function getLevelFromXP(absoluteXP: number): number {
    if (absoluteXP <= 0) return 1;
    // XP = Base * (Level - 1)^Factor
    // Level = (XP / Base)^(1/Factor) + 1
    const rawLevel = Math.pow(absoluteXP / BASE_XP, 1 / GROWTH_FACTOR) + 1;
    return Math.floor(rawLevel);
}

/**
 * Calculates the exact XP required to reach a specific level from zero.
 */
export function getAbsoluteXPForLevel(level: number): number {
    if (level <= 1) return 0;
    return Math.floor(BASE_XP * Math.pow(level - 1, GROWTH_FACTOR));
}

/**
 * Returns progression details for the UI progress bar.
 */
export function getLevelProgress(totalXP: number) {
    const currentLevel = getLevelFromXP(totalXP);
    const xpForCurrentLevel = getAbsoluteXPForLevel(currentLevel);
    const xpForNextLevel = getAbsoluteXPForLevel(currentLevel + 1);

    const xpInCurrentLevel = totalXP - xpForCurrentLevel;
    const xpRequiredForNext = xpForNextLevel - xpForCurrentLevel;
    const progressPercent = Math.max(0, Math.min(100, (xpInCurrentLevel / xpRequiredForNext) * 100));

    return {
        level: currentLevel,
        currentLevelXP: Math.floor(xpInCurrentLevel),
        nextLevelRequiredXP: Math.floor(xpRequiredForNext),
        progressPercent,
        xpRemaining: Math.floor(xpRequiredForNext - xpInCurrentLevel),
    };
}

// --- Dynamic XP Multipliers --- //

export interface XPParams {
    sm2Quality: number; // 0-5 (from sm2.ts gradeAnswer)
    bpm: number; // Current tempo
    isWeakSpot: boolean; // Was this identified as a highly failed/weak fret?
    streakDays: number; // Current continuous streak
}

/**
 * Calculates the XP yield for a single correct action using dynamic multipliers.
 * The system rewards fast reflexes, high tempo, and tackling weak spots.
 */
export function calculateDynamicXP(params: XPParams): number {
    let multiplier = 1.0;

    // 1. SM-2 Quality Multiplier (Reflex Speed)
    // Quality 5 (Instant): 2.0x
    // Quality 4 (Quick): 1.5x
    // Quality 3 (Slow): 1.0x
    // Quality < 3: Incorrect, yields 0 XP usually, but if passed here, penalize.
    if (params.sm2Quality >= 5) multiplier *= 2.0;
    else if (params.sm2Quality === 4) multiplier *= 1.5;
    else if (params.sm2Quality < 3) multiplier *= 0.5;

    // 2. Tempo/BPM Multiplier (Physical/Mental Load)
    // Baseline is 60 BPM (1.0x). Caps at 2.0x (200 BPM).
    if (params.bpm > 60) {
        const bpmBonus = Math.min(1.0, (params.bpm - 60) / (MAX_SCALING_BPM - 60));
        multiplier *= (1.0 + bpmBonus);
    }

    // 3. Weak Spot Bonus (Incentivize facing fears)
    if (params.isWeakSpot) {
        multiplier *= 1.5;
    }

    // Calculate base yield before streak applies
    const actionYield = Math.round(BASE_CORRECT_XP * multiplier);

    // 4. Global Streak Multiplier
    const streakMult = getStreakMultiplier(params.streakDays);

    return Math.round(actionYield * streakMult);
}

/**
 * Returns the current global XP multiplier based on login streaks.
 */
export function getStreakMultiplier(streakDays: number): number {
    if (streakDays >= 30) return STREAK_MILESTONES[30];
    if (streakDays >= 14) return STREAK_MILESTONES[14];
    if (streakDays >= 7) return STREAK_MILESTONES[7];
    return 1.0;
}
