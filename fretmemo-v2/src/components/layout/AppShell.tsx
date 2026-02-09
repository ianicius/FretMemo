import { useEffect, useLayoutEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { Home, Target, Trophy, ChartBar, Settings, CircleHelp, Coffee, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GlobalFeedbackToast } from "@/components/ui/global-feedback-toast";
import { useAppStore } from "@/stores/useAppStore";
import { useGameStore } from "@/stores/useGameStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { EXTERNAL_LINKS } from "@/lib/externalLinks";
import type { TabId } from "@/types";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";
import { DarkModeToggle } from "./DarkModeToggle";
import { SeoManager } from "./SeoManager";

interface NavItem {
    id: TabId;
    label: string;
    icon: React.ElementType;
    path: string;
}

const NAV_ITEMS: NavItem[] = [
    { id: "home", label: "Home", icon: Home, path: "/" },
    { id: "practice", label: "Train", icon: Target, path: "/train" },
    { id: "challenges", label: "Challenges", icon: Trophy, path: "/challenges" },
    { id: "progress", label: "Me", icon: ChartBar, path: "/me" },
];

const RESOURCE_LINKS: Array<{ label: string; href: string }> = [
    { label: "FAQ", href: EXTERNAL_LINKS.faq },
    { label: "Blog", href: EXTERNAL_LINKS.blog },
];

export function AppShell() {
    const navigate = useNavigate();
    const location = useLocation();
    const navigationType = useNavigationType();
    const { setTab } = useAppStore();
    const { isPlaying } = useGameStore();
    const theme = useSettingsStore((state) => state.full.display.theme);
    const mainScrollRef = useRef<HTMLElement | null>(null);

    const activePath = location.pathname;
    const isPracticeSessionRoute = activePath === "/practice" || activePath.startsWith("/practice/");
    const isTrainRoute = activePath === "/train" || activePath.startsWith("/train") || activePath.startsWith("/technique/");
    const isFocusMode = isPracticeSessionRoute && isPlaying;

    const handleNav = (item: NavItem) => {
        setTab(item.id);
        navigate(item.path);
    };

    useEffect(() => {
        if (typeof window === "undefined") return;

        const root = document.documentElement;
        const media = window.matchMedia("(prefers-color-scheme: dark)");

        const applyTheme = () => {
            const shouldUseDark = theme === "dark" || (theme === "system" && media.matches);
            root.classList.toggle("dark", shouldUseDark);
        };

        applyTheme();
        if (theme !== "system") return;

        const handleSystemThemeChange = () => applyTheme();
        media.addEventListener("change", handleSystemThemeChange);
        return () => media.removeEventListener("change", handleSystemThemeChange);
    }, [theme]);

    useLayoutEffect(() => {
        const routeState = location.state as { restoreTrain?: boolean } | null;
        const isTrainPopRestore = navigationType === "POP" && location.pathname === "/train";
        if (isTrainPopRestore || routeState?.restoreTrain) {
            return;
        }

        const resetScroll = () => {
            if (mainScrollRef.current) {
                mainScrollRef.current.scrollTop = 0;
                mainScrollRef.current.scrollLeft = 0;
                mainScrollRef.current.scrollTo({ top: 0, left: 0, behavior: "auto" });
            }
            window.scrollTo({ top: 0, left: 0, behavior: "auto" });
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        };

        resetScroll();
        const frameId = window.requestAnimationFrame(resetScroll);
        const timeoutId = window.setTimeout(resetScroll, 40);

        return () => {
            window.cancelAnimationFrame(frameId);
            window.clearTimeout(timeoutId);
        };
    }, [location.key, location.pathname, location.search, location.hash, navigationType, location.state]);

    return (
        <div className="flex min-h-screen bg-background text-foreground safe-area-inset">
            <SeoManager />

            <aside className="hidden md:flex w-16 lg:w-64 border-r border-border flex-col bg-card/30 sticky top-0 h-screen">
                <div className="h-14 flex items-center justify-center lg:justify-start lg:px-6 border-b border-border/50">
                    <span className="font-bold text-xl text-primary hidden lg:inline">FretMemo</span>
                    <span className="font-bold text-xl text-primary lg:hidden">FM</span>
                </div>

                <div className="flex-1 py-4 overflow-y-auto">
                    <div className="space-y-1">
                        {NAV_ITEMS.map((item) => {
                            const isActive = item.id === "practice"
                                ? isTrainRoute || isPracticeSessionRoute
                                : item.id === "progress"
                                    ? activePath.startsWith("/me") || activePath.startsWith("/progress") || activePath.startsWith("/settings")
                                    : activePath === item.path || (item.path !== "/" && activePath.startsWith(item.path));

                            return (
                                <Button
                                    key={item.id}
                                    variant={isActive ? "secondary" : "ghost"}
                                    className={cn(
                                        "w-full justify-start rounded-none lg:rounded-md lg:mx-2 lg:w-auto h-12 lg:h-10",
                                        !isActive && "text-muted-foreground",
                                        "px-0 lg:px-4"
                                    )}
                                    onClick={() => handleNav(item)}
                                >
                                    <div className="w-16 lg:w-auto flex justify-center lg:justify-start items-center">
                                        <item.icon className={cn("w-5 h-5 lg:mr-3", isActive && "text-primary")} />
                                    </div>
                                    <span className="hidden lg:inline">{item.label}</span>
                                </Button>
                            );
                        })}
                    </div>
                </div>

                <div className="p-4 border-t border-border/50 space-y-3">
                    <div className="hidden lg:block px-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Help</p>
                    </div>
                    <div className="hidden lg:flex items-center gap-3 px-1">
                        {RESOURCE_LINKS.map((link) => (
                            <Button key={link.label} asChild variant="link" size="sm" className="h-auto px-0 text-xs text-muted-foreground">
                                <a href={link.href} target="_blank" rel="noreferrer noopener">
                                    {link.label}
                                </a>
                            </Button>
                        ))}
                    </div>
                    <Button asChild className="hidden lg:flex w-full control-btn--primary justify-start">
                        <a href={EXTERNAL_LINKS.buyMeCoffee} target="_blank" rel="noreferrer noopener">
                            <Coffee className="w-4 h-4" />
                            Buy me a coffee
                        </a>
                    </Button>
                    <Button asChild variant="link" size="sm" className="hidden lg:flex h-auto w-full justify-start px-1 text-xs text-muted-foreground">
                        <a href={EXTERNAL_LINKS.contactMailto}>
                            <Mail className="w-3.5 h-3.5" />
                            {EXTERNAL_LINKS.contactEmail}
                        </a>
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button asChild variant="ghost" size="icon" className="lg:hidden">
                            <a href={EXTERNAL_LINKS.buyMeCoffee} target="_blank" rel="noreferrer noopener" aria-label="Buy me a coffee">
                                <Coffee className="w-5 h-5" />
                            </a>
                        </Button>
                        <Button asChild variant="ghost" size="icon" className="lg:hidden">
                            <a href={EXTERNAL_LINKS.faq} target="_blank" rel="noreferrer noopener" aria-label="Open FAQ">
                                <CircleHelp className="w-5 h-5" />
                            </a>
                        </Button>
                        <Button variant="ghost" className="flex-1 justify-start text-muted-foreground" onClick={() => navigate("/me?section=settings")}>
                            <Settings className="w-5 h-5 lg:mr-3" />
                            <span className="hidden lg:inline">Settings</span>
                        </Button>
                        <DarkModeToggle />
                    </div>
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0 bg-background/50 relative">
                <div className="md:hidden">
                    {!isFocusMode && <Header />}
                </div>

                <main
                    id="app-main-scroll"
                    ref={mainScrollRef}
                    className={cn("flex-1 overflow-y-auto", isFocusMode ? "pb-0" : "pb-20 md:pb-0")}
                >
                    <div
                        className={cn(
                            "container max-w-5xl py-4 md:py-6 mx-auto px-4 md:px-6",
                            isPracticeSessionRoute && "h-full max-w-6xl py-2 md:py-3",
                            isFocusMode && "px-2 md:px-6 py-2 md:py-3"
                        )}
                    >
                        <Outlet />
                    </div>
                </main>

                {!isFocusMode && <BottomNav />}
            </div>

            <GlobalFeedbackToast />
        </div>
    );
}
