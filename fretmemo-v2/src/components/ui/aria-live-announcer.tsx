import { useEffect, useState } from "react";

interface AriaLiveAnnouncerProps {
    message: string | null;
    politeness?: "polite" | "assertive";
}

/**
 * Screen reader announcer for dynamic feedback.
 * Visually hidden but announced by assistive technologies.
 */
export function AriaLiveAnnouncer({ message, politeness = "polite" }: AriaLiveAnnouncerProps) {
    const [announcement, setAnnouncement] = useState("");

    useEffect(() => {
        if (!message) {
            setAnnouncement("");
            return;
        }

        // Clear then set to ensure re-announcement of same message
        setAnnouncement("");
        const timeoutId = setTimeout(() => setAnnouncement(message), 50);
        return () => clearTimeout(timeoutId);
    }, [message]);

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
