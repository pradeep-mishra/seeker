import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";

// Pages (eagerly loaded)
import BrowserPage from "./pages/BrowserPage";
import ImagePreviewPage from "./pages/ImagePreviewPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import SettingsPage from "./pages/SettingsPage";
import SetupPage from "./pages/SetupPage";
import TextEditorPage from "./pages/TextEditorPage";
import UserManagementPage from "./pages/UserManagementPage";

// Lazy loaded pages
const VideoPlayerPage = lazy(() => import("./pages/VideoPlayerPage"));

// Components
import { LoadingScreen } from "./components/common/LoadingScreen";
import { ToastContainer } from "./components/common/Toast";
import { AppLayout } from "./components/layout/AppLayout";

/**
 * Protected route wrapper
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isInitialized } = useAuthStore();

  if (!isInitialized || isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/**
 * Public route wrapper (redirects if already authenticated)
 */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isInitialized, requiresSetup } =
    useAuthStore();

  if (!isInitialized || isLoading) {
    return <LoadingScreen />;
  }

  if (requiresSetup) {
    return <Navigate to="/setup" replace />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

/**
 * Main App component
 */
export default function App() {
  const { initialize, isInitialized, requiresSetup, isAuthenticated } =
    useAuthStore();

  // Initialize auth on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Show loading while initializing
  if (!isInitialized) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Routes>
        {/* Setup route for first-time users */}
        <Route
          path="/setup"
          element={
            requiresSetup ? (
              <SetupPage />
            ) : (
              <Navigate to={isAuthenticated ? "/" : "/login"} replace />
            )
          }
        />

        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }>
          <Route index element={<BrowserPage />} />
          <Route path="browse/*" element={<BrowserPage />} />
          <Route path="editor" element={<TextEditorPage />} />
          <Route path="preview" element={<ImagePreviewPage />} />
          <Route
            path="video"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <VideoPlayerPage />
              </Suspense>
            }
          />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="users" element={<UserManagementPage />} />
        </Route>

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global toast notifications */}
      <ToastContainer />
    </>
  );
}
