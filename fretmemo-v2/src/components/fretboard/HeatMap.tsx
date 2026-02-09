import type { HeatMapData } from "@/types/progress";


interface HeatMapProps {
    data: HeatMapData;
    visible: boolean;
}

export function HeatMapOverlay({ data: _data, visible }: HeatMapProps) {

    if (!visible) return null;
    void _data;

    return (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-xl">
            {/* 
                This component would overlay a canvas or SVG heatmap based on 'data'.
                For now, it's a placeholder struct that NoteDots can consume directly via 'opacity' prop loop logic
                in the parent Fretboard component, rather than a separate physical overlay layer blocking clicks.
                
                The real heatmap logic is often best handled by passing 'opacity/color' into NoteDot props
                directly during the render loop in Fretboard.tsx. 
             */}
            <div className="w-full h-full bg-gradient-to-r from-transparent via-primary/5 to-transparent opacity-20" />
        </div>
    );
}
