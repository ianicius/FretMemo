import { Button } from "@/components/ui/button";

interface SessionStopButtonProps {
    onStop: () => void;
    label?: string;
}

export function SessionStopButton({
    onStop,
    label = "Stop",
}: SessionStopButtonProps) {
    return (
        <Button variant="outline" onClick={onStop} className="w-full sm:w-auto">
            {label}
        </Button>
    );
}
