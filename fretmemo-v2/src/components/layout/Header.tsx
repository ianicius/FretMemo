import {
    ChartBar,
    CircleHelp,
    Coffee,
    Flame,
    History,
    Mail,
    Menu,
    Moon,
    Newspaper,
    Settings,
    Snowflake,
    Star,
    Sun,
    Target,
    Trophy,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProgressStore } from "@/stores/useProgressStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { EXTERNAL_LINKS } from "@/lib/externalLinks";
import { trackEvent } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Header() {
    const navigate = useNavigate();
    const { streakDays, streakFreezes, totalCorrect } = useProgressStore();
    const { full, updateFullSettings } = useSettingsStore();
    const xp = totalCorrect * 10;

    const isDark =
        full.display.theme === "dark" ||
        (full.display.theme === "system" &&
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches);

    const toggleDarkMode = () => {
        const newTheme = isDark ? "light" : "dark";
        updateFullSettings({ display: { ...full.display, theme: newTheme } });
    };

    return (
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center justify-between px-4 md:px-6">
                <div className="min-w-0">
                    <span className="truncate text-lg font-bold tracking-tight text-primary">FretMemo</span>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-2.5 py-1">
                    <span
                        className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300"
                        title="Current streak"
                    >
                        <Flame className="h-4 w-4 fill-current" />
                        <span className="text-xs font-semibold tabular-nums">{streakDays}</span>
                    </span>
                    {streakFreezes > 0 && (
                        <span
                            className="hidden items-center gap-1 text-sky-600 min-[390px]:inline-flex dark:text-sky-300"
                            title={`${streakFreezes} streak freeze${streakFreezes !== 1 ? "s" : ""} available`}
                        >
                            <Snowflake className="h-3.5 w-3.5" />
                            <span className="text-[11px] font-semibold tabular-nums">{streakFreezes}</span>
                        </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-primary" title="Total XP">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="text-xs font-semibold tabular-nums">{xp}</span>
                    </span>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleDarkMode}
                        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                    >
                        {isDark ? (
                            <Sun className="h-5 w-5 text-primary" />
                        ) : (
                            <Moon className="h-5 w-5 text-muted-foreground" />
                        )}
                        <span className="sr-only">{isDark ? "Light mode" : "Dark mode"}</span>
                    </Button>

                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden h-12 w-12 rounded-full p-2">
                                <Menu className="h-6 w-6" />
                                <span className="sr-only">Open quick menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-[82vh]">
                            <div className="space-y-6 pt-6">
                                <section className="space-y-3">
                                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                        Quick Actions
                                    </p>
                                    <div className="grid gap-2">
                                        <Button variant="outline" className="justify-start" onClick={() => navigate("/train")}>
                                            <Target className="mr-2 h-4 w-4" />
                                            Train
                                        </Button>
                                        <Button variant="outline" className="justify-start" onClick={() => navigate("/challenges")}>
                                            <Trophy className="mr-2 h-4 w-4" />
                                            Challenges
                                        </Button>
                                        <Button variant="outline" className="justify-start" onClick={() => navigate("/me?section=progress")}>
                                            <ChartBar className="mr-2 h-4 w-4" />
                                            Progress
                                        </Button>
                                        <Button variant="outline" className="justify-start" onClick={() => navigate("/me?section=settings")}>
                                            <Settings className="mr-2 h-4 w-4" />
                                            Settings
                                        </Button>
                                    </div>
                                </section>

                                <section className="space-y-3">
                                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                        Resources
                                    </p>
                                    <div className="grid gap-2">
                                        <Button asChild className="control-btn--primary justify-start">
                                            <a href={EXTERNAL_LINKS.buyMeCoffee} target="_blank" rel="noreferrer noopener">
                                                <Coffee className="mr-2 h-4 w-4" />
                                                Buy me a coffee
                                            </a>
                                        </Button>
                                        <Button asChild variant="outline" className="justify-start">
                                            <a
                                                href={EXTERNAL_LINKS.legacyV1}
                                                target="_blank"
                                                rel="noreferrer noopener"
                                                onClick={() => trackEvent("fm_v2_to_v1_clicked", { cta_id: "header_menu_legacy_v1" })}
                                            >
                                                <History className="mr-2 h-4 w-4" />
                                                Legacy v1
                                            </a>
                                        </Button>
                                        <Button asChild variant="outline" className="justify-start">
                                            <a href={EXTERNAL_LINKS.faq} target="_blank" rel="noreferrer noopener">
                                                <CircleHelp className="mr-2 h-4 w-4" />
                                                FAQ
                                            </a>
                                        </Button>
                                        <Button asChild variant="outline" className="justify-start">
                                            <a href={EXTERNAL_LINKS.blog} target="_blank" rel="noreferrer noopener">
                                                <Newspaper className="mr-2 h-4 w-4" />
                                                Blog
                                            </a>
                                        </Button>
                                        <Button asChild variant="outline" className="justify-start">
                                            <a href={EXTERNAL_LINKS.contactMailto}>
                                                <Mail className="mr-2 h-4 w-4" />
                                                {EXTERNAL_LINKS.contactEmail}
                                            </a>
                                        </Button>
                                    </div>
                                </section>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    );
}
