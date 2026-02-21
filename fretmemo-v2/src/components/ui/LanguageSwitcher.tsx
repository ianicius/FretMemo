import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { ChevronUp } from 'lucide-react';

const languages = [
    { code: 'en', label: 'English', flag: '🇬🇧', short: 'EN' },
    { code: 'pl', label: 'Polski', flag: '🇵🇱', short: 'PL' }
];

export function LanguageSwitcher({ className, direction = "up" }: { className?: string; direction?: "up" | "down" }) {
    const { i18n } = useTranslation();
    const currentLang = i18n.resolvedLanguage || i18n.language || 'en';
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const activeLanguage = languages.find(l => l.code === currentLang) || languages[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const setLanguage = (lang: string) => {
        i18n.changeLanguage(lang);
        trackEvent("language_changed", { language: lang });
        setIsOpen(false);
    };

    return (
        <div ref={dropdownRef} className={cn("relative z-50", className)}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex h-8 items-center gap-1.5 rounded-full border border-border/50 bg-background hover:bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
                <span className="text-sm leading-none">{activeLanguage.flag}</span>
                <span className="font-bold tracking-wide">{activeLanguage.short}</span>
                <ChevronUp className={cn("h-3 w-3 text-muted-foreground transition-transform duration-200", isOpen ? "" : "rotate-180")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        // Mobile headers usually drop down, sidebars drop up. Given we use ChevronUp by default, 
                        // absolute bottom-full mb-2 handles sidebar well. 
                        // But wait! If it's in a header, 'bottom-full' will open upwards out of the screen.
                        // Let's position it to flow absolute standard, we'll let the user provide a custom position class if needed, or default to bottom-full.
                        className={cn(
                            "absolute left-0 min-w-[120px] overflow-hidden rounded-xl border border-border/50 bg-background shadow-lg backdrop-blur-md",
                            direction === "up" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"
                        )}
                    >
                        <div className="flex flex-col p-1">
                            {languages.map((lang) => {
                                const isActive = currentLang === lang.code;
                                return (
                                    <button
                                        key={lang.code}
                                        onClick={() => setLanguage(lang.code)}
                                        className={cn(
                                            "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
                                            isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        )}
                                    >
                                        <span className="text-base leading-none">{lang.flag}</span>
                                        <span>{lang.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
