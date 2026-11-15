import { describe, expect, it } from "vitest";
import { IMPROV_SESSION_MODE, useQuestStore } from "../useQuestStore";

describe("daily quests: improv session of the day (plan F1)", () => {
    it("is offered every day and completes when the session is finished", () => {
        useQuestStore.setState({ quests: [], lastGeneratedDate: null });
        useQuestStore.getState().checkAndRefreshQuests();
        const find = () => useQuestStore.getState().quests.find((quest) => quest.metadata?.targetMode === IMPROV_SESSION_MODE);
        expect(useQuestStore.getState().quests).toHaveLength(4);
        expect(find()?.isCompleted).toBe(false);

        useQuestStore.getState().updateProgress("play_mode", 1, { mode: "ear-training" });
        expect(find()?.isCompleted).toBe(false);
        useQuestStore.getState().updateProgress("play_mode", 1, { mode: IMPROV_SESSION_MODE });
        expect(find()?.isCompleted).toBe(true);
    });
});
