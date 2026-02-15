/* global window, document, localStorage, sessionStorage */
(function () {
    const USER_ID_KEY = "fretmemo_analytics_user_id";
    const SESSION_ID_KEY = "fretmemo_v1_session_id";
    const MIGRATION_MARKER_KEY = "fretmemo_v1_to_v2_transition";
    const APP_VERSION = "v1";

    function getAmplitude() {
        if (typeof window === "undefined") return null;
        if (!window.amplitude || typeof window.amplitude.track !== "function") return null;
        return window.amplitude;
    }

    function randomId(prefix) {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return `${prefix}_${crypto.randomUUID()}`;
        }
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    function readStorage(storage, key) {
        try {
            return storage.getItem(key);
        } catch (_error) {
            return null;
        }
    }

    function writeStorage(storage, key, value) {
        try {
            storage.setItem(key, value);
        } catch (_error) {
            // no-op
        }
    }

    function getOrCreateUserId() {
        const existing = readStorage(localStorage, USER_ID_KEY);
        if (existing) return existing;
        const created = randomId("fm_user");
        writeStorage(localStorage, USER_ID_KEY, created);
        return created;
    }

    function getOrCreateSessionId() {
        const existing = readStorage(sessionStorage, SESSION_ID_KEY);
        if (existing) return existing;
        const created = randomId("fm_v1_session");
        writeStorage(sessionStorage, SESSION_ID_KEY, created);
        return created;
    }

    function baseEventProps(extra) {
        return Object.assign({
            app_version: APP_VERSION,
            app_surface: "web",
            session_id: getOrCreateSessionId(),
            page_path: window.location.pathname,
            page_url: window.location.href,
        }, extra || {});
    }

    function track(eventName, eventProps) {
        const amplitude = getAmplitude();
        if (!amplitude) return;
        try {
            amplitude.track(eventName, baseEventProps(eventProps));
        } catch (_error) {
            // no-op
        }
    }

    function identify() {
        const amplitude = getAmplitude();
        if (!amplitude) return;

        const userId = getOrCreateUserId();
        if (typeof amplitude.setUserId === "function") {
            amplitude.setUserId(userId);
        }

        if (typeof amplitude.Identify === "function" && typeof amplitude.identify === "function") {
            try {
                const identifyObj = new amplitude.Identify();
                if (typeof identifyObj.set === "function") {
                    identifyObj.set("app_version", APP_VERSION);
                    identifyObj.set("app_surface", "web");
                }
                amplitude.identify(identifyObj);
            } catch (_error) {
                // no-op
            }
        }
    }

    function markTransitionToV2(ctaId) {
        const marker = {
            source: "v1",
            cta_id: ctaId || "unknown",
            path: window.location.pathname,
            timestamp: Date.now(),
        };
        writeStorage(localStorage, MIGRATION_MARKER_KEY, JSON.stringify(marker));
    }

    function withV2TrackingParams(href, ctaId) {
        try {
            const url = new URL(href, window.location.origin);
            if (url.origin !== window.location.origin) return href;

            url.searchParams.set("fm_from", "v1");
            url.searchParams.set("fm_cta", ctaId || "unknown");
            url.searchParams.set("fm_ts", String(Date.now()));
            return url.pathname + url.search + url.hash;
        } catch (_error) {
            return href;
        }
    }

    function bindV2Links() {
        const links = document.querySelectorAll("[data-track-v2-link]");
        links.forEach((link) => {
            link.addEventListener("click", () => {
                const ctaId = link.getAttribute("data-track-v2-link") || "unknown";
                const rawHref = link.getAttribute("href") || "/v2/";
                const trackedHref = withV2TrackingParams(rawHref, ctaId);

                markTransitionToV2(ctaId);
                track("fm_v1_to_v2_clicked", {
                    cta_id: ctaId,
                    destination_url: trackedHref,
                });

                if (trackedHref !== rawHref) {
                    link.setAttribute("href", trackedHref);
                }
            });
        });
    }

    function init() {
        identify();
        track("fm_v1_page_view", {
            page_title: document.title || "",
            referrer: document.referrer || null,
        });
        bindV2Links();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    window.fretmemoAnalytics = {
        track,
        markTransitionToV2,
    };
})();
