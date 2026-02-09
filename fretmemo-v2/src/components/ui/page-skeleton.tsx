/**
 * Skeleton loader for route transitions.
 * Shows animated placeholders while lazy-loaded pages are loading.
 */
export function PageSkeleton() {
    return (
        <div className="animate-pulse space-y-4 p-4">
            {/* Header skeleton */}
            <div className="h-8 w-48 rounded-lg bg-muted" />
            <div className="h-4 w-64 rounded bg-muted" />

            {/* Card skeleton */}
            <div className="mt-6 rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="h-5 w-32 rounded bg-muted" />
                <div className="h-4 w-full rounded bg-muted" />
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-10 w-full rounded-lg bg-muted" />
            </div>

            {/* List skeleton */}
            <div className="mt-4 space-y-2">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-lg bg-muted" />
                ))}
            </div>
        </div>
    );
}
