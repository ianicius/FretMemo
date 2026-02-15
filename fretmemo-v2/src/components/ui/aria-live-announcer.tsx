interface AriaLiveAnnouncerProps {
    message: string | null;
    politeness?: "polite" | "assertive";
}

/**
 * Screen reader announcer for dynamic feedback.
 * Visually hidden but announced by assistive technologies.
 */
export function AriaLiveAnnouncer({ message, politeness = "polite" }: AriaLiveAnnouncerProps) {
    const announcement = message ?? "";

    return (
        <div
            role="status"
            aria-live={politeness}
            aria-atomic="true"
            className="sr-only"
        >
            {announcement}
        </div>
    );
}
