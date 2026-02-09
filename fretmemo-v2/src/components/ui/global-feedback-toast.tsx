import { FeedbackToast } from "@/components/ui/feedback-toast";
import { useFeedbackStore } from "@/stores/useFeedbackStore";

export function GlobalFeedbackToast() {
    const active = useFeedbackStore((state) => state.active);
    const dismissActive = useFeedbackStore((state) => state.dismissActive);

    return (
        <FeedbackToast
            isOpen={Boolean(active)}
            message={active?.message ?? ""}
            tone={active?.tone ?? "info"}
            durationMs={active?.durationMs ?? 2800}
            onClose={dismissActive}
        />
    );
}
