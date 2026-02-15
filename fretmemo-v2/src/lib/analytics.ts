type AnalyticsEventProps = Record<string, unknown>;

interface AmplitudeIdentify {
    set: (key: string, value: unknown) => void;
}

interface AmplitudeClient {
    track: (eventName: string, eventProps?: AnalyticsEventProps) => void;
    setUserId?: (userId: string | null) => void;
    identify?: (identify: AmplitudeIdentify) => void;
    Identify?: new () => AmplitudeIdentify;
}

declare global {
    interface Window {
        amplitude?: AmplitudeClient;
    }
}

const USER_ID_KEY = "fretmemo_analytics_user_id";
const SESSION_ID_KEY = "fretmemo_v2_session_id";
const MIGRATION_MARKER_KEY = "fretmemo_v1_to_v2_transition";
const MIGRATION_TRACKED_SESSION_KEY = "fretmemo_v2_migration_tracked";
const APP_VERSION = "v2";

let initialized = false;

function getAmplitude(): AmplitudeClient | null {
    if (typeof window === "undefined") return null;
    if (!window.amplitude || typeof window.amplitude.track !== "function") return null;
    return window.amplitude;
}

function randomId(prefix: string): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function safeReadStorage(storage: Storage, key: string): string | null {
    try {
        return storage.getItem(key);
    } catch {
        return null;
    }
}

function safeWriteStorage(storage: Storage, key: string, value: string): void {
    try {
        storage.setItem(key, value);
    } catch {
        // no-op
    }
}

function safeRemoveStorage(storage: Storage, key: string): void {
    try {
        storage.removeItem(key);
    } catch {
        // no-op
    }
}

function getOrCreateUserId(): string {
    const existing = safeReadStorage(localStorage, USER_ID_KEY);
    if (existing) return existing;
    const created = randomId("fm_user");
    safeWriteStorage(localStorage, USER_ID_KEY, created);
    return created;
}

function getOrCreateSessionId(): string {
    const existing = safeReadStorage(sessionStorage, SESSION_ID_KEY);
    if (existing) return existing;
    const created = randomId("fm_v2_session");
    safeWriteStorage(sessionStorage, SESSION_ID_KEY, created);
    return created;
}

function withDefaultProps(eventProps: AnalyticsEventProps = {}): AnalyticsEventProps {
    return {
        app_version: APP_VERSION,
        app_surface: "web",
        session_id: getOrCreateSessionId(),
        page_path: window.location.pathname,
        page_url: window.location.href,
        ...eventProps,
    };
}

function identifyV2User(): void {
    const amplitude = getAmplitude();
    if (!amplitude) return;

    const userId = getOrCreateUserId();
    if (typeof amplitude.setUserId === "function") {
        amplitude.setUserId(userId);
    }

    if (typeof amplitude.Identify === "function" && typeof amplitude.identify === "function") {
        try {
            const identifyObj = new amplitude.Identify();
            identifyObj.set("app_version", APP_VERSION);
            identifyObj.set("app_surface", "web");
            amplitude.identify(identifyObj);
        } catch {
            // no-op
        }
    }
}

function trackMigrationFromV1(): void {
    const alreadyTracked = safeReadStorage(sessionStorage, MIGRATION_TRACKED_SESSION_KEY) === "1";
    if (alreadyTracked) return;

    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get("fm_from");
    const ctaParam = params.get("fm_cta");
    const tsParam = params.get("fm_ts");

    let markerSource: string | null = null;
    let markerCtaId: string | null = null;
    let markerTimestamp: number | null = null;

    const migrationMarkerRaw = safeReadStorage(localStorage, MIGRATION_MARKER_KEY);
    if (migrationMarkerRaw) {
        try {
            const marker = JSON.parse(migrationMarkerRaw) as {
                source?: string;
                cta_id?: string;
                timestamp?: number;
            };
            markerSource = typeof marker.source === "string" ? marker.source : null;
            markerCtaId = typeof marker.cta_id === "string" ? marker.cta_id : null;
            markerTimestamp = typeof marker.timestamp === "number" ? marker.timestamp : null;
        } catch {
            // no-op
        }
    }

    const cameFromV1 = fromParam === "v1" || markerSource === "v1";
    if (!cameFromV1) return;

    const queryTimestamp = tsParam ? Number(tsParam) : null;
    const sourceTimestamp = Number.isFinite(queryTimestamp ?? Number.NaN)
        ? (queryTimestamp as number)
        : markerTimestamp;
    const transitionLatencyMs =
        typeof sourceTimestamp === "number" && Number.isFinite(sourceTimestamp)
            ? Math.max(0, Date.now() - sourceTimestamp)
            : null;

    trackEvent("fm_v2_opened_from_v1", {
        entry_source: fromParam ?? markerSource ?? "v1",
        cta_id: ctaParam ?? markerCtaId ?? "unknown",
        transition_latency_ms: transitionLatencyMs,
    });

    safeWriteStorage(sessionStorage, MIGRATION_TRACKED_SESSION_KEY, "1");
    safeRemoveStorage(localStorage, MIGRATION_MARKER_KEY);
}

export function initAnalyticsV2(): void {
    if (initialized) return;
    initialized = true;

    identifyV2User();

    trackEvent("fm_v2_app_loaded", {
        entry_path: window.location.pathname,
    });

    trackMigrationFromV1();
}

export function trackEvent(eventName: string, eventProps: AnalyticsEventProps = {}): void {
    const amplitude = getAmplitude();
    if (!amplitude) return;
    try {
        amplitude.track(eventName, withDefaultProps(eventProps));
    } catch {
        // no-op
    }
}

export function trackRouteView(pathname: string, search: string, hash: string): void {
    trackEvent("fm_v2_route_viewed", {
        route_path: pathname,
        route_search: search || "",
        route_hash: hash || "",
    });
}
