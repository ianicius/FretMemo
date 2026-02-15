import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackRouteView } from "@/lib/analytics";

export function RouteAnalyticsTracker() {
    const location = useLocation();

    useEffect(() => {
        trackRouteView(location.pathname, location.search, location.hash);
    }, [location.pathname, location.search, location.hash]);

    return null;
}
