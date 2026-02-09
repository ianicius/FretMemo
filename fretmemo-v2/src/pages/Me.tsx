import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProgressPage from "@/pages/Progress";
import SettingsPage from "@/pages/Settings";

type MeSection = "progress" | "settings";

export default function Me() {
    const [searchParams, setSearchParams] = useSearchParams();
    const sectionParam = searchParams.get("section");
    const section: MeSection = sectionParam === "settings" ? "settings" : "progress";

    const setSection = (next: MeSection) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("section", next);
        setSearchParams(nextParams, { replace: true });
    };

    const content = useMemo(() => {
        if (section === "settings") return <SettingsPage />;
        return <ProgressPage />;
    }, [section]);

    return (
        <div className="space-y-4 pb-8">
            <div className="sticky top-0 z-20 border-b border-border/50 bg-background/95 py-2 backdrop-blur">
                <Tabs value={section} onValueChange={(value) => setSection(value as MeSection)} className="w-full">
                    <TabsList className="grid w-full max-w-sm grid-cols-2">
                        <TabsTrigger value="progress">Progress</TabsTrigger>
                        <TabsTrigger value="settings">Settings</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
            {content}
        </div>
    );
}
