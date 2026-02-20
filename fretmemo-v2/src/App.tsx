import { Suspense, lazy } from "react";
import { BrowserRouter, HashRouter, Navigate, Routes, Route } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { RouteAnalyticsTracker } from "./components/analytics/RouteAnalyticsTracker";
import { PageSkeleton } from "./components/ui/page-skeleton";
import { ErrorBoundary } from "./components/ui/error-boundary";

const Home = lazy(() => import("./pages/Home"));
const Practice = lazy(() => import("./pages/Practice"));
const Library = lazy(() => import("./pages/Library"));
const Technique = lazy(() => import("./pages/Technique"));
const Challenges = lazy(() => import("./pages/Challenges"));
const Me = lazy(() => import("./pages/Me"));
const TheoryTool = lazy(() => import("./pages/TheoryTool"));
const EarTraining = lazy(() => import("./pages/EarTraining"));
const RhythmDojo = lazy(() => import("./pages/RhythmDojo"));

const basename = import.meta.env.BASE_URL.replace(/\/+$/, "") || "/";

function AppRoutes() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RouteAnalyticsTracker />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/train" element={<Library />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/library" element={<Navigate to="/train" replace />} />
          <Route path="/technique/:id" element={<Technique />} />
          <Route path="/theory/:toolId" element={<TheoryTool />} />
          <Route path="/ear-training/:mode" element={<EarTraining />} />
          <Route path="/rhythm/:mode" element={<RhythmDojo />} />
          <Route path="/challenges" element={<Challenges />} />
          <Route path="/me" element={<Me />} />
          <Route path="/progress" element={<Navigate to="/me?section=progress" replace />} />
          <Route path="/settings" element={<Navigate to="/me?section=settings" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function App() {
  import("./stores/useQuestStore").then(({ useQuestStore }) => {
    useQuestStore.getState().checkAndRefreshQuests();
  }).catch(err => console.error("Failed to refresh quests", err));

  return (
    <ErrorBoundary>
      {import.meta.env.VITE_USE_HASH_ROUTER === "true" ? (
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      ) : (
        <BrowserRouter basename={basename}>
          <AppRoutes />
        </BrowserRouter>
      )}
    </ErrorBoundary>
  );
}

export default App;
