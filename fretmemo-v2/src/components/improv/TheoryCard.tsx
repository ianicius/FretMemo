/**
 * Theory card for the improv module view (run improv-training-2026-11-13).
 * Renders the module's theory text (PL prose with EN terminology) from the
 * `improv.modules.<id>.theory` i18n key, plus the optional theory-tool
 * embed defined in the curriculum (plan phase 2).
 */

import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";
import CircleOfFifths from "@/components/theory/CircleOfFifths";
import ScaleExplorer from "@/components/theory/ScaleExplorer";
import ChordLibrary from "@/components/theory/ChordLibrary";
import TriadVisualizer from "@/components/theory/TriadVisualizer";
import type { TheoryEmbed } from "@/data/improv/curriculum";

interface TheoryCardProps {
    theoryKey: string;
    embed?: TheoryEmbed;
}

function TheoryEmbedView({ embed }: { embed: TheoryEmbed }) {
    switch (embed.tool) {
        case "circle-of-fifths":
            return <CircleOfFifths />;
        case "scale-explorer":
            return <ScaleExplorer initialRoot={embed.root as never} initialScaleType={embed.scaleType} />;
        case "chord-library":
            return <ChordLibrary initialRoot={embed.root} />;
        case "triad-visualizer":
            return <TriadVisualizer initialRoot={embed.root as never} />;
        default:
            return null;
    }
}

export function TheoryCard({ theoryKey, embed }: TheoryCardProps) {
    const { t } = useTranslation();

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <BookOpen className="h-4 w-4 text-primary" />
                    {t("improv.module.theoryTitle")}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed text-muted-foreground">{t(theoryKey)}</p>
                {embed && (
                    <div className="rounded-lg border border-border bg-card/40 p-2">
                        <TheoryEmbedView embed={embed} />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
