import { Suspense, lazy } from "react";
import { BrowserRouter, HashRouter, Navigate, Routes, Route } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { PageSkeleton } from "./components/ui/page-skeleton";
import { ErrorBoundary } from "./components/ui/error-boundary";

const Home = lazy(() => import("./pages/Home"));
const Practice = lazy(() => import("./pages/Practice"));
const Library = lazy(() => import("./pages/Library"));
const Technique = lazy(() => import("./pages/Technique"));
const Challenges = lazy(() => import("./pages/Challenges"));
const Me = lazy(() => import("./pages/Me"));

function App() {
  const Router = import.meta.env.VITE_USE_HASH_ROUTER === "true" ? HashRouter : BrowserRouter;

  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Home />} />
              <Route path="/train" element={<Library />} />
              <Route path="/practice" element={<Practice />} />
              <Route path="/library" element={<Navigate to="/train" replace />} />
              <Route path="/technique/:id" element={<Technique />} />
              <Route path="/challenges" element={<Challenges />} />
              <Route path="/me" element={<Me />} />
              <Route path="/progress" element={<Navigate to="/me?section=progress" replace />} />
              <Route path="/settings" element={<Navigate to="/me?section=settings" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
