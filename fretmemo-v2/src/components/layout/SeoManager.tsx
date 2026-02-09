import { useEffect } from "react";
import { useLocation } from "react-router-dom";

type SeoRouteMeta = {
    title: string;
    description: string;
    path: string;
};

const BASE_URL = "https://fretmemo.net";

const DEFAULT_META: SeoRouteMeta = {
    title: "Guitar Fretboard Trainer - Fretboard Memorization & Note Learning Tool | FretMemo",
    description:
        "Master the guitar fretboard with an interactive trainer. Test your note knowledge with quizzes, practice with a metronome, and track your progress.",
    path: "/",
};

function getRouteMeta(pathname: string): SeoRouteMeta {
    if (pathname === "/train") {
        return {
            title: "Train Guitar Drills, Technique & Theory | FretMemo",
            description:
                "Train fretboard drills, technique routines, and guided practice sessions in one place with tempo control and focused constraints.",
            path: "/train",
        };
    }

    if (pathname === "/practice") {
        return {
            title: "Focused Practice Session | FretMemo",
            description:
                "Run a focused fretboard practice session with live scoring, metronome control, and adaptive feedback.",
            path: "/practice",
        };
    }

    if (pathname === "/challenges") {
        return {
            title: "Daily Guitar Challenges | FretMemo",
            description:
                "Train consistency with challenge-based guitar fretboard exercises, streak tracking, and gamified progress goals.",
            path: "/challenges",
        };
    }

    if (pathname === "/me") {
        return {
            title: "Your Guitar Progress & Settings | FretMemo",
            description:
                "Review your guitar learning progress, track accuracy trends, and customize settings from one personal hub.",
            path: "/me",
        };
    }

    if (pathname.startsWith("/technique/")) {
        return {
            title: "Technique Exercise Trainer | FretMemo",
            description:
                "Practice focused guitar technique routines with tempo control, visual guidance, and adaptive exercise settings.",
            path: pathname,
        };
    }

    return DEFAULT_META;
}

function upsertMetaByName(name: string, content: string): void {
    let element = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
    if (!element) {
        element = document.createElement("meta");
        element.setAttribute("name", name);
        document.head.appendChild(element);
    }
    element.setAttribute("content", content);
}

function upsertMetaByProperty(property: string, content: string): void {
    let element = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
    if (!element) {
        element = document.createElement("meta");
        element.setAttribute("property", property);
        document.head.appendChild(element);
    }
    element.setAttribute("content", content);
}

function upsertCanonical(href: string): void {
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
    }
    link.setAttribute("href", href);
}

export function SeoManager() {
    const location = useLocation();

    useEffect(() => {
        const meta = getRouteMeta(location.pathname);
        const canonicalUrl = `${BASE_URL}${meta.path === "/" ? "/" : meta.path}`;

        document.title = meta.title;
        upsertMetaByName("description", meta.description);
        upsertCanonical(canonicalUrl);

        upsertMetaByProperty("og:title", meta.title);
        upsertMetaByProperty("og:description", meta.description);
        upsertMetaByProperty("og:url", canonicalUrl);

        upsertMetaByProperty("twitter:title", meta.title);
        upsertMetaByProperty("twitter:description", meta.description);
        upsertMetaByProperty("twitter:url", canonicalUrl);
    }, [location.pathname]);

    return null;
}
