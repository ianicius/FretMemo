import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettingsStore } from '@/stores/useSettingsStore';

export function DarkModeToggle() {
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
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="shrink-0"
        >
            {isDark ? (
                <Sun className="w-5 h-5 text-primary" />
            ) : (
                <Moon className="w-5 h-5 text-muted-foreground" />
            )}
            <span className="sr-only">{isDark ? "Light Mode" : "Dark Mode"}</span>
        </Button>
    );
}
