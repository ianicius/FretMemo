/**
 * Theory card for the improv module view (run improv-training-2026-11-13).
 * Renders the module's theory text (PL prose with EN terminology) from the
 * `improv.modules.<id>.theory` i18n key.
 */

import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

interface TheoryCardProps {
    theoryKey: string;
}

export function TheoryCard({ theoryKey }: TheoryCardProps) {
    const { t } = useTranslation();

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <BookOpen className="h-4 w-4 text-primary" />
                    {t("improv.module.theoryTitle")}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{t(theoryKey)}</p>
            </CardContent>
        </Card>
    );
}
