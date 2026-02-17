import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
    indicatorClassName?: string;
};

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, indicatorClassName, children, ...props }, ref) => {
        return (
            <div className="relative">
                <select
                    ref={ref}
                    className={cn(
                        "peer flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm shadow-sm ring-offset-background transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        className
                    )}
                    {...props}
                >
                    {children}
                </select>
                <ChevronDown
                    className={cn(
                        "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors",
                        "peer-focus-visible:text-foreground",
                        indicatorClassName
                    )}
                    aria-hidden
                />
            </div>
        );
    }
);

Select.displayName = "Select";

export { Select };

