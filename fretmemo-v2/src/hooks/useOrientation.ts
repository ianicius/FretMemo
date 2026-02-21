import { useState, useEffect, useCallback } from "react";

export function useOrientation() {
    const [isLandscape, setIsLandscape] = useState(
        () => typeof window !== "undefined" && window.innerWidth > window.innerHeight
    );

    useEffect(() => {
        const mq = window.matchMedia("(orientation: landscape)");
        const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    const requestFullscreen = useCallback(async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            }
        } catch {
            /* not supported or denied */
        }
    }, []);

    const exitFullscreen = useCallback(async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
        } catch {
            /* not supported */
        }
    }, []);

    return { isLandscape, requestFullscreen, exitFullscreen };
}
