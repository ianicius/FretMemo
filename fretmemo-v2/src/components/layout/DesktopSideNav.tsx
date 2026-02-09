import { Link, useLocation } from "react-router-dom";
import { Home, Crosshair, Trophy, BarChart2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function DesktopSideNav({ onSettingsClick }: { onSettingsClick: () => void }) {
    const location = useLocation();

    const navItems = [
        { icon: Home, label: "Home", path: "/" },
        { icon: Crosshair, label: "Train", path: "/train" },
        { icon: Trophy, label: "Challenges", path: "/challenges" },
        { icon: BarChart2, label: "Me", path: "/me" },
    ];

    return (
        <div className="hidden lg:flex flex-col w-64 border-r bg-card h-screen sticky top-0">
            <div className="p-6">
                <h1 className="text-2xl font-bold tracking-tight">FretMemo</h1>
            </div>

            <nav className="flex-1 px-4 space-y-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t">
                <Button variant="ghost" className="w-full justify-start gap-3" onClick={onSettingsClick}>
                    <Settings className="h-4 w-4" />
                    Settings
                </Button>
            </div>
        </div>
    );
}
