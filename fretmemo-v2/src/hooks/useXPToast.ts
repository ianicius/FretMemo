import { useState } from "react";
import type { XPToastType } from "@/components/practice/XPToast";

interface XPToastState {
    isVisible: boolean;
    xp: number;
    streak: number;
    type: XPToastType;
    message?: string;
}

export function useXPToast() {
    const [toast, setToast] = useState<XPToastState>({
        isVisible: false,
        xp: 0,
        streak: 0,
        type: "correct",
    });

    const showToast = (xp: number, type: XPToastType = "correct", streak = 0, message?: string) => {
        setToast({
            isVisible: true,
            xp,
            streak,
            type,
            message,
        });
    };

    const hideToast = () => {
        setToast((prev) => ({ ...prev, isVisible: false }));
    };

    return {
        toast,
        showToast,
        hideToast,
    };
}

