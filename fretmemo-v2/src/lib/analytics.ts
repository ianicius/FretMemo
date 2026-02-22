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

interface AnalyticsRuntimeConfig {
    replaySampleRate?: number;
}

type GtagFn = (command: string, eventName: string, params?: Record<string, unknown>) => void;

declare global {
    interface Window {
        amplitude?: AmplitudeClient;
        __fretmemoAnalyticsConfig?: AnalyticsRuntimeConfig;
        gtag?: GtagFn;
    }
}

const USER_ID_KEY = "fretmemo_analytics_user_id";
const SESSION_ID_KEY = "fretmemo_v2_session_id";
const USER_ACTIVATED_KEY = "fretmemo_v2_user_activated";
const MIGRATION_MARKER_KEY = "fretmemo_v1_to_v2_transition";
const MIGRATION_TRACKED_SESSION_KEY = "fretmemo_v2_migration_tracked";
const ATTRIBUTION_FIRST_TOUCH_KEY = "fretmemo_v2_attr_first_touch";
const ATTRIBUTION_LAST_TOUCH_KEY = "fretmemo_v2_attr_last_touch";
const APP_VERSION = "v2";
const WEB_VITAL_SAMPLE_RATE = 0.1;
const MAX_FRONTEND_ERRORS_PER_PAGE = 10;

let initialized = false;
let gaManualRouteTrackingInitialized = false;
let globalErrorTrackingInstalled = false;
let webVitalsTrackingInstalled = false;
let frontendErrorCount = 0;

interface EntryContext {
    fromParam: string | null;
    ctaParam: string | null;
    sourceTimestamp: number | null;
    markerSource: string | null;
    markerCtaId: string | null;
}

interface AttributionTouchData {
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_content: string | null;
    utm_term: string | null;
    referrer_host: string | null;
    landing_path: string;
    captured_at: number;
}

interface WebVitalEntry extends PerformanceEntry {
    value?: number;
    hadRecentInput?: boolean;
    interactionId?: number;
}

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

function safeReadJson<T>(storage: Storage, key: string): T | null {
    const raw = safeReadStorage(storage, key);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
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
    const replaySampleRate = window.__fretmemoAnalyticsConfig?.replaySampleRate;
    const browserLanguage =
        typeof navigator !== "undefined" && typeof navigator.language === "string"
            ? navigator.language
            : "unknown";

    return {
        app_version: APP_VERSION,
        app_surface: "web",
        session_id: getOrCreateSessionId(),
        page_path: window.location.pathname,
        page_url: window.location.href,
        browser_language: browserLanguage,
        replay_sample_rate:
            typeof replaySampleRate === "number" && Number.isFinite(replaySampleRate)
                ? replaySampleRate
                : null,
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

function getEntryContext(): EntryContext {
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

    const queryTimestamp = tsParam ? Number(tsParam) : null;
    const sourceTimestamp = Number.isFinite(queryTimestamp ?? Number.NaN)
        ? (queryTimestamp as number)
        : markerTimestamp;

    return {
        fromParam,
        ctaParam,
        sourceTimestamp,
        markerSource,
        markerCtaId,
    };
}

function trackMigrationFromV1(context: EntryContext): void {
    const alreadyTracked = safeReadStorage(sessionStorage, MIGRATION_TRACKED_SESSION_KEY) === "1";
    if (alreadyTracked) return;

    const cameFromV1 = context.fromParam === "v1" || context.markerSource === "v1";
    if (!cameFromV1) return;

    const transitionLatencyMs =
        typeof context.sourceTimestamp === "number" && Number.isFinite(context.sourceTimestamp)
            ? Math.max(0, Date.now() - context.sourceTimestamp)
            : null;

    trackEvent("fm_v2_opened_from_v1", {
        entry_source: context.fromParam ?? context.markerSource ?? "v1",
        cta_id: context.ctaParam ?? context.markerCtaId ?? "unknown",
        transition_latency_ms: transitionLatencyMs,
    });

    safeWriteStorage(sessionStorage, MIGRATION_TRACKED_SESSION_KEY, "1");
    safeRemoveStorage(localStorage, MIGRATION_MARKER_KEY);
}

function sendAmplitudeEvent(eventName: string, eventProps: AnalyticsEventProps = {}): void {
    const amplitude = getAmplitude();
    if (!amplitude) return;
    try {
        amplitude.track(eventName, withDefaultProps(eventProps));
    } catch {
        // no-op
    }
}

function parseModuleFromSessionEndedEvent(eventName: string): string | null {
    const match = /^fm_v2_(.+)_session_ended$/.exec(eventName);
    if (!match?.[1]) return null;

    const rawModule = match[1];
    if (rawModule === "ear_training") return "ear";
    return rawModule;
}

function maybeTrackUserActivated(eventName: string): void {
    if (typeof window === "undefined") return;
    if (eventName === "fm_v2_user_activated") return;

    const moduleName = parseModuleFromSessionEndedEvent(eventName);
    if (!moduleName) return;

    const alreadyActivated = safeReadStorage(localStorage, USER_ACTIVATED_KEY) === "1";
    if (alreadyActivated) return;

    safeWriteStorage(localStorage, USER_ACTIVATED_KEY, "1");
    sendAmplitudeEvent("fm_v2_user_activated", {
        activation_type: "first_session_completed",
        module: moduleName,
        source_event: eventName,
    });
}

function normalizeAttributionValue(value: string | null, maxLength = 64): string | null {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    return normalized.slice(0, maxLength);
}

function getReferrerHost(): string | null {
    if (typeof document === "undefined") return null;
    const referrer = document.referrer;
    if (!referrer) return null;

    try {
        const url = new URL(referrer);
        const currentHost = typeof window !== "undefined" ? window.location.hostname : null;
        if (currentHost && url.hostname === currentHost) return null;
        return normalizeAttributionValue(url.hostname, 80);
    } catch {
        return null;
    }
}

function getCurrentAttributionTouch(): AttributionTouchData | null {
    if (typeof window === "undefined") return null;

    const params = new URLSearchParams(window.location.search);
    const utm_source = normalizeAttributionValue(params.get("utm_source"));
    const utm_medium = normalizeAttributionValue(params.get("utm_medium"));
    const utm_campaign = normalizeAttributionValue(params.get("utm_campaign"), 80);
    const utm_content = normalizeAttributionValue(params.get("utm_content"), 80);
    const utm_term = normalizeAttributionValue(params.get("utm_term"), 80);
    const referrer_host = getReferrerHost();

    const hasAttributionSignal = Boolean(
        utm_source || utm_medium || utm_campaign || utm_content || utm_term || referrer_host
    );
    if (!hasAttributionSignal) return null;

    return {
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        referrer_host,
        landing_path: `${window.location.pathname}${window.location.hash || ""}`.slice(0, 200),
        captured_at: Date.now(),
    };
}

function isSameAttributionTouch(a: AttributionTouchData | null, b: AttributionTouchData | null): boolean {
    if (!a || !b) return false;
    return (
        a.utm_source === b.utm_source &&
        a.utm_medium === b.utm_medium &&
        a.utm_campaign === b.utm_campaign &&
        a.utm_content === b.utm_content &&
        a.utm_term === b.utm_term &&
        a.referrer_host === b.referrer_host &&
        a.landing_path === b.landing_path
    );
}

function captureAttributionTouch(): void {
    if (typeof window === "undefined") return;

    const currentTouch = getCurrentAttributionTouch();
    if (!currentTouch) return;

    const firstTouch = safeReadJson<AttributionTouchData>(localStorage, ATTRIBUTION_FIRST_TOUCH_KEY);
    const lastTouch = safeReadJson<AttributionTouchData>(localStorage, ATTRIBUTION_LAST_TOUCH_KEY);

    if (!firstTouch) {
        safeWriteStorage(localStorage, ATTRIBUTION_FIRST_TOUCH_KEY, JSON.stringify(currentTouch));
        trackEvent("fm_v2_attribution_captured", {
            ...currentTouch,
            touch_type: "first",
        });
    }

    if (!isSameAttributionTouch(lastTouch, currentTouch)) {
        safeWriteStorage(localStorage, ATTRIBUTION_LAST_TOUCH_KEY, JSON.stringify(currentTouch));
        trackEvent("fm_v2_attribution_captured", {
            ...currentTouch,
            touch_type: "last",
        });
    }
}

function bucketErrorMessage(message: string | null | undefined): string {
    if (!message) return "unknown";
    return message
        .toLowerCase()
        .replace(/\d+/g, "#")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) || "unknown";
}

function getSourceAreaFromFilename(filename: string | null | undefined): string {
    if (!filename) return "unknown";
    const normalized = filename.toLowerCase();
    if (normalized.includes("/assets/") || normalized.includes("\\assets\\")) return "bundle";
    if (normalized.includes("technique")) return "technique";
    if (normalized.includes("practice")) return "practice";
    if (normalized.includes("rhythm")) return "rhythm";
    if (normalized.includes("ear")) return "ear";
    if (normalized.includes("theory")) return "theory";
    if (normalized.includes("analytics")) return "analytics";
    return "app";
}

function trackFrontendError(errorType: string, errorBucket: string, sourceArea: string, fatal: boolean): void {
    if (frontendErrorCount >= MAX_FRONTEND_ERRORS_PER_PAGE) return;
    frontendErrorCount += 1;

    trackEvent("fm_v2_frontend_error", {
        error_type: errorType,
        error_bucket: errorBucket,
        source_area: sourceArea,
        fatal,
    });
}

function installGlobalErrorTracking(): void {
    if (typeof window === "undefined" || globalErrorTrackingInstalled) return;
    globalErrorTrackingInstalled = true;

    window.addEventListener("error", (event) => {
        const errorEvent = event as ErrorEvent;
        trackFrontendError(
            "error",
            bucketErrorMessage(errorEvent.message || errorEvent.error?.name || "error"),
            getSourceAreaFromFilename(errorEvent.filename),
            true
        );
    });

    window.addEventListener("unhandledrejection", (event) => {
        const rejectionEvent = event as PromiseRejectionEvent;
        const reason = rejectionEvent.reason;
        const reasonMessage =
            typeof reason === "string"
                ? reason
                : typeof reason?.message === "string"
                    ? reason.message
                    : typeof reason?.name === "string"
                        ? reason.name
                        : "promise_rejection";

        trackFrontendError("unhandledrejection", bucketErrorMessage(reasonMessage), "app", true);
    });
}

function getWebVitalRating(metricName: "LCP" | "CLS" | "INP", value: number): "good" | "needs_improvement" | "poor" {
    if (metricName === "LCP") {
        if (value <= 2500) return "good";
        if (value <= 4000) return "needs_improvement";
        return "poor";
    }

    if (metricName === "CLS") {
        if (value <= 0.1) return "good";
        if (value <= 0.25) return "needs_improvement";
        return "poor";
    }

    if (value <= 200) return "good";
    if (value <= 500) return "needs_improvement";
    return "poor";
}

function installWebVitalsTracking(): void {
    if (typeof window === "undefined" || typeof PerformanceObserver === "undefined" || webVitalsTrackingInstalled) {
        return;
    }
    webVitalsTrackingInstalled = true;

    if (Math.random() > WEB_VITAL_SAMPLE_RATE) return;

    let lcpValue = 0;
    let clsValue = 0;
    let inpValue = 0;
    let flushed = false;

    const canObserve = (entryType: string): boolean =>
        Array.isArray(PerformanceObserver.supportedEntryTypes) &&
        PerformanceObserver.supportedEntryTypes.includes(entryType);

    if (canObserve("largest-contentful-paint")) {
        try {
            const lcpObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                if (!lastEntry) return;
                lcpValue = Math.round(lastEntry.startTime);
            });
            lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
        } catch {
            // no-op
        }
    }

    if (canObserve("layout-shift")) {
        try {
            const clsObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    const layoutShift = entry as WebVitalEntry;
                    if (layoutShift.hadRecentInput) continue;
                    clsValue += Number(layoutShift.value ?? 0);
                }
            });
            clsObserver.observe({ type: "layout-shift", buffered: true });
        } catch {
            // no-op
        }
    }

    if (canObserve("event")) {
        try {
            const eventObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    const interaction = entry as WebVitalEntry;
                    if (!interaction.interactionId) continue;
                    inpValue = Math.max(inpValue, Math.round(entry.duration));
                }
            });
            eventObserver.observe(
                { type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit & {
                    durationThreshold: number;
                }
            );
        } catch {
            // no-op
        }
    }

    const flushWebVitals = () => {
        if (flushed) return;
        flushed = true;

        const routeLikePath = `${window.location.pathname}${window.location.hash || ""}`;
        if (lcpValue > 0) {
            trackEvent("fm_v2_web_vital_reported", {
                metric_name: "LCP",
                value: lcpValue,
                rating: getWebVitalRating("LCP", lcpValue),
                page_path: routeLikePath,
            });
        }

        if (clsValue > 0) {
            const roundedCls = Math.round(clsValue * 1000) / 1000;
            trackEvent("fm_v2_web_vital_reported", {
                metric_name: "CLS",
                value: roundedCls,
                rating: getWebVitalRating("CLS", roundedCls),
                page_path: routeLikePath,
            });
        }

        if (inpValue > 0) {
            trackEvent("fm_v2_web_vital_reported", {
                metric_name: "INP",
                value: inpValue,
                rating: getWebVitalRating("INP", inpValue),
                page_path: routeLikePath,
            });
        }
    };

    const handleVisibilityChange = () => {
        if (document.visibilityState === "hidden") {
            flushWebVitals();
        }
    };

    window.addEventListener("pagehide", flushWebVitals, { once: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
}

export function initAnalyticsV2(): void {
    if (initialized) return;
    initialized = true;

    const entryContext = getEntryContext();
    const entryLatencyMs =
        typeof entryContext.sourceTimestamp === "number" && Number.isFinite(entryContext.sourceTimestamp)
            ? Math.max(0, Date.now() - entryContext.sourceTimestamp)
            : null;

    identifyV2User();
    installGlobalErrorTracking();
    installWebVitalsTracking();
    captureAttributionTouch();

    trackEvent("fm_v2_app_loaded", {
        entry_path: window.location.pathname,
        entry_source: entryContext.fromParam ?? entryContext.markerSource ?? "direct",
        entry_cta_id: entryContext.ctaParam ?? entryContext.markerCtaId ?? null,
        entry_latency_ms: entryLatencyMs,
        has_tracking_query: Boolean(entryContext.fromParam || entryContext.ctaParam),
    });

    trackMigrationFromV1(entryContext);
}

export function trackEvent(eventName: string, eventProps: AnalyticsEventProps = {}): void {
    sendAmplitudeEvent(eventName, eventProps);
    maybeTrackUserActivated(eventName);
}

export function trackRouteView(pathname: string, search: string, hash: string): void {
    trackEvent("fm_v2_route_viewed", {
        route_path: pathname,
        route_search: search || "",
        route_hash: hash || "",
    });

    if (typeof window === "undefined" || typeof window.gtag !== "function") return;

    const pagePath = `${pathname}${search || ""}${hash || ""}`;
    if (!gaManualRouteTrackingInitialized) {
        gaManualRouteTrackingInitialized = true;
        return;
    }

    try {
        window.gtag("event", "page_view", {
            page_location: window.location.href,
            page_path: pagePath,
            page_title: typeof document !== "undefined" ? document.title : "",
        });
    } catch {
        // no-op
    }
}

export function trackFeatureOpened(featureArea: string, featureId: string | null, entrySource: string | null = null): void {
    trackEvent("fm_v2_feature_opened", {
        feature_area: featureArea,
        feature_id: featureId,
        entry_source: entrySource ?? "direct",
    });
}

export function trackNavigationClicked(sourceSurface: string, targetPath: string, targetId: string): void {
    trackEvent("fm_v2_navigation_clicked", {
        source_surface: sourceSurface,
        target_path: targetPath,
        target_id: targetId,
    });
}
