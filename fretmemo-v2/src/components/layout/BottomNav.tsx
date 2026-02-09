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
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border md:hidden safe-area-bottom">
            <div className="flex justify-around items-center h-16">
                {NAV_ITEMS.map((item) => {
                    // Check active state
                    const isActive = item.id === 'practice'
                        ? activePath.startsWith('/train') || activePath.startsWith('/practice')
                        : item.id === 'progress'
                            ? activePath.startsWith('/me') || activePath.startsWith('/progress') || activePath.startsWith('/settings')
                            : activePath === item.path || (item.path !== '/' && activePath.startsWith(item.path));

                    return (
                        <button
                            key={item.id}
                            onClick={() => handleNav(item)}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200",
                                isActive
                                    ? "text-primary"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <item.icon className={cn("w-6 h-6", isActive && "animate-pulse-subtle")} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
