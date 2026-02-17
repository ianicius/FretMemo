import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Target, Trophy, ChartBar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import type { TabId } from '@/types';

interface NavItem {
    id: TabId;
    label: string;
    icon: React.ElementType;
    path: string;
}

const NAV_ITEMS: NavItem[] = [
    { id: 'home', label: 'Home', icon: Home, path: '/' },
    { id: 'practice', label: 'Train', icon: Target, path: '/train' },
    { id: 'challenges', label: 'Challenges', icon: Trophy, path: '/challenges' },
    { id: 'progress', label: 'Me', icon: ChartBar, path: '/me' },
];

export function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const { setTab } = useAppStore();

    // Determine active tab based on path if needed, or use store sync
    // For now, we sync store on click
    const activePath = location.pathname;

    const handleNav = (item: NavItem) => {
        setTab(item.id);
        navigate(item.path);
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm md:hidden safe-area-bottom">
            <div className="mx-auto flex h-16 max-w-md items-center px-2">
                {NAV_ITEMS.map((item) => {
                    const isActive = item.id === 'practice'
                        ? activePath.startsWith('/train') || activePath.startsWith('/practice')
                        : item.id === 'progress'
                            ? activePath.startsWith('/me') || activePath.startsWith('/progress') || activePath.startsWith('/settings')
                            : activePath === item.path || (item.path !== '/' && activePath.startsWith(item.path));

                    return (
                        <button
                            key={item.id}
                            onClick={() => handleNav(item)}
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                                "relative flex h-full flex-1 flex-col items-center justify-center gap-1 rounded-lg transition-colors duration-200",
                                isActive
                                    ? "text-primary"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <span
                                className={cn(
                                    "absolute top-1 h-0.5 w-8 rounded-full bg-primary transition-opacity duration-200",
                                    isActive ? "opacity-100" : "opacity-0"
                                )}
                            />
                            <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-[11px] font-medium leading-none">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
