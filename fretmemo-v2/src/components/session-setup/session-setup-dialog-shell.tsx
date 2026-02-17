import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface SessionSetupDialogShellProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    badgeLabel?: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    contentClassName?: string;
    bodyClassName?: string;
}

export function SessionSetupDialogShell({
    isOpen,
    onOpenChange,
    title,
    badgeLabel,
    description,
    children,
    footer,
    contentClassName,
    bodyClassName,
}: SessionSetupDialogShellProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className={cn("flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-md", contentClassName)}>
                <DialogHeader className="shrink-0 border-b border-border/50 px-6 py-4 pr-12">
                    <DialogTitle className="text-left">
                        <div className="text-base font-semibold">{title}</div>
                        {(badgeLabel || description) && (
                            <div className="mt-1 flex items-center gap-2">
                                {badgeLabel && <Badge variant="secondary">{badgeLabel}</Badge>}
                                {description && <span className="text-xs font-normal text-muted-foreground">{description}</span>}
                            </div>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className={cn("flex-1 overflow-y-auto px-6 py-4", bodyClassName)}>{children}</div>
                {footer}
            </DialogContent>
        </Dialog>
    );
}
