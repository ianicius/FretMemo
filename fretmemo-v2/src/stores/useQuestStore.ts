import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useProgressStore } from './useProgressStore';
import { trackEvent } from '@/lib/analytics';

export type QuestType = 'gain_xp' | 'play_mode' | 'correct_streak' | 'practice_time';

export interface Quest {
    id: string;
    type: QuestType;
    title: string;
    description: string;
    target: number;
    current: number;
    xpReward: number;
    isCompleted: boolean;
    isClaimed: boolean;
    metadata?: {
        targetMode?: string; // For 'play_mode' (e.g., 'fretboardToNote', 'rhythm-reading')
    };
}

interface QuestState {
    quests: Quest[];
    lastGeneratedDate: string | null;

    // Actions
    checkAndRefreshQuests: () => void;
    updateProgress: (type: QuestType, amount: number, metadata?: any) => void;
    claimReward: (questId: string) => void;
}

const generateDailyQuests = (): Quest[] => {
    // A simple pool of quests to draw from. In a real app, this could be more dynamic.
    const pool = [
        {
            type: 'gain_xp' as QuestType,
            title: 'Daily Dedication',
            description: 'Earn 300 XP today',
            target: 300,
            xpReward: 100,
        },
        {
            type: 'correct_streak' as QuestType,
            title: 'Unbreakable Focus',
            description: 'Achieve a streak of 20 correct answers',
            target: 20,
            xpReward: 150,
        },
        {
            type: 'play_mode' as QuestType,
            title: 'Ear Training',
            description: 'Complete a session in Ear Training',
            target: 1,
            xpReward: 100,
            metadata: { targetMode: 'ear-training' }
        },
        {
            type: 'gain_xp' as QuestType,
            title: 'Pushing Limits',
            description: 'Earn 500 XP today',
            target: 500,
            xpReward: 200,
        },
        {
            type: 'play_mode' as QuestType,
            title: 'Rhythm Mastery',
            description: 'Complete a session in Rhythm Dojo',
            target: 1,
            xpReward: 100,
            metadata: { targetMode: 'rhythm-dojo' }
        },
        {
            type: 'correct_streak' as QuestType,
            title: 'Flawless Execution',
            description: 'Achieve a streak of 50 correct answers',
            target: 50,
            xpReward: 250,
        }
    ];

    // Shuffle and pick 3 quests
    const shuffled = pool.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);

    return selected.map((q, index) => ({
        id: `quest-${Date.now()}-${index}`,
        type: q.type,
        title: q.title,
        description: q.description,
        target: q.target,
        current: 0,
        xpReward: q.xpReward,
        isCompleted: false,
        isClaimed: false,
        metadata: q.metadata,
    }));
};

const getTodayString = () => new Date().toLocaleDateString('en-CA');

export const useQuestStore = create<QuestState>()(
    persist(
        (set, get) => ({
            quests: [],
            lastGeneratedDate: null,

            checkAndRefreshQuests: () => {
                const today = getTodayString();
                const { lastGeneratedDate } = get();

                if (today !== lastGeneratedDate) {
                    const newQuests = generateDailyQuests();
                    set({
                        quests: newQuests,
                        lastGeneratedDate: today,
                    });
                }
            },

            updateProgress: (type, amount, metadata) => {
                set((state) => {
                    let updated = false;
                    const newQuests = state.quests.map((quest) => {
                        if (quest.isCompleted || quest.type !== type) return quest;

                        // Check metadata constraints
                        if (quest.type === 'play_mode' && quest.metadata?.targetMode) {
                            if (quest.metadata.targetMode !== metadata?.mode) {
                                return quest;
                            }
                        }

                        let newCurrent = quest.current;

                        if (type === 'correct_streak') {
                            // Streak is not cumulative, it needs to reach the target in one go
                            // We are passed the current active streak length
                            newCurrent = Math.max(quest.current, amount);
                        } else {
                            // Cumulative (XP, time)
                            newCurrent = Math.min(quest.current + amount, quest.target);
                        }

                        if (newCurrent !== quest.current) {
                            updated = true;
                            const isCompleted = newCurrent >= quest.target;

                            if (isCompleted) {
                                trackEvent('quest_completed', { quest_id: quest.id, quest_type: quest.type });
                            }

                            return { ...quest, current: newCurrent, isCompleted };
                        }

                        return quest;
                    });

                    return updated ? { quests: newQuests } : state;
                });
            },

            claimReward: (questId) => {
                const quest = get().quests.find(q => q.id === questId);
                if (!quest || !quest.isCompleted || quest.isClaimed) return;

                // Add XP via ProgressStore
                const progressStore = useProgressStore.getState();
                // We'll need a generic method in progressStore to just add raw XP, 
                // or we update totalXP directly.
                progressStore.addBonusXP(quest.xpReward);

                set((state) => ({
                    quests: state.quests.map((q) =>
                        q.id === questId ? { ...q, isClaimed: true } : q
                    ),
                }));

                trackEvent('quest_reward_claimed', { quest_id: quest.id, reward_amount: quest.xpReward });
            },
        }),
        {
            name: 'fretmemo-quests-v2',
            version: 1,
        }
    )
);
