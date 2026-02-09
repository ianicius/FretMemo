import { Flame, Star, Menu, Sun, Moon, CircleHelp, Newspaper, Coffee, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProgressStore } from '@/stores/useProgressStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { EXTERNAL_LINKS } from '@/lib/externalLinks';

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

export function Header() {
    const navigate = useNavigate();
    const { streakDays, totalCorrect } = useProgressStore();
    const { full, updateFullSettings } = useSettingsStore();
    const isDark =
        full.display.theme === 'dark' ||
        (full.display.theme === 'system' &&
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-color-scheme: dark)').matches);

    const toggleDarkMode = () => {
        const newTheme = isDark ? 'light' : 'dark';
        updateFullSettings({ display: { ...full.display, theme: newTheme } });
    };

    return (
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center justify-between px-4 md:px-6">

                {/* Left: Brand / Menu */}
                <div className="flex items-center gap-2">
                    <span className="font-bold tracking-tight text-lg text-primary">FretMemo</span>
                </div>

                {/* Center: Stats (Hidden on very small screens if crowded, but critical for gamification) */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-amber-700 dark:text-amber-300" title="Current Streak">
                        <Flame className="w-5 h-5 fill-current" />
                        <span className="font-bold text-sm">{streakDays}</span>
                    </div>

                    <div className="flex items-center gap-1 text-primary" title="Total XP">
                        <Star className="w-5 h-5 fill-current" />
                        <span className="font-bold text-sm">{totalCorrect * 10}</span>
                    </div>
                </div>

                {/* Right: Settings / Profile */}
                <div className="flex items-center gap-2">
                    <Button asChild variant="ghost" size="icon" title="Support on Ko-fi">
                        <a href={EXTERNAL_LINKS.buyMeCoffee} target="_blank" rel="noreferrer noopener" aria-label="Buy me a coffee">
                            <Coffee className="w-5 h-5 text-primary" />
                        </a>
                    </Button>

                    <Button asChild variant="ghost" size="icon" title="Open FAQ">
                        <a href={EXTERNAL_LINKS.faq} target="_blank" rel="noreferrer noopener" aria-label="Open FAQ">
                            <CircleHelp className="w-5 h-5 text-muted-foreground" />
                        </a>
                    </Button>

                    {/* Dark Mode Toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleDarkMode}
                        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    >
                        {isDark ? (
                            <Sun className="w-5 h-5 text-primary" />
                        ) : (
                            <Moon className="w-5 h-5 text-muted-foreground" />
                        )}
                        <span className="sr-only">{isDark ? "Light Mode" : "Dark Mode"}</span>
                    </Button>

                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden">
                                <Menu className="w-5 h-5" />
                                <span className="sr-only">Menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-[80vh]">
                            <div className="space-y-4 pt-6">
                                <h2 className="text-base font-semibold">Quick Menu</h2>
                                <div className="grid gap-2">
                                    <Button variant="outline" className="justify-start" onClick={() => navigate('/me?section=settings')}>
                                        Settings
                                    </Button>
                                    <Button variant="outline" className="justify-start" onClick={() => navigate('/challenges')}>
                                        Challenges
                                    </Button>
                                    <Button variant="outline" className="justify-start" onClick={() => navigate('/me?section=progress')}>
                                        Progress
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <h2 className="text-base font-semibold">Resources</h2>
                                <div className="grid gap-2">
                                    <Button asChild className="justify-start control-btn--primary">
                                        <a href={EXTERNAL_LINKS.buyMeCoffee} target="_blank" rel="noreferrer noopener">
                                            <Coffee className="w-4 h-4 mr-2" />
                                            Buy me a coffee
                                        </a>
                                    </Button>
                                    <Button asChild variant="outline" className="justify-start">
                                        <a href={EXTERNAL_LINKS.faq} target="_blank" rel="noreferrer noopener">
                                            <CircleHelp className="w-4 h-4 mr-2" />
                                            FAQ
                                        </a>
                                    </Button>
                                    <Button asChild variant="outline" className="justify-start">
                                        <a href={EXTERNAL_LINKS.blog} target="_blank" rel="noreferrer noopener">
                                            <Newspaper className="w-4 h-4 mr-2" />
                                            Blog
                                        </a>
                                    </Button>
                                    <Button asChild variant="outline" className="justify-start">
                                        <a href={EXTERNAL_LINKS.contactMailto}>
                                            <Mail className="w-4 h-4 mr-2" />
                                            Contact
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    );
}

