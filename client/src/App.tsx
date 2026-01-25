import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppContainer } from './components/layout/AppContainer';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { EncryptionProvider } from './context/EncryptionContext';
import { SyncProvider } from './context/SyncContext';
import { SyncBridge } from './components/SyncBridge';
import { useSecurity } from './hooks/useSecurity';
import { LoadingFallback } from './components/LoadingFallback';
import { Login } from './components/auth/Login';
import { BiometricGuard } from './components/auth/BiometricGuard';
import { ErrorBoundary } from './components/ErrorBoundary'; // Import ErrorBoundary
import { Toaster } from 'react-hot-toast';
import { App as CapacitorApp } from '@capacitor/app';
import { scheduleGhostNotifications, clearGhostNotifications } from './services/offlineGhostService';

// Lazy Load Pages
// Note: We use the default export from the new Landing.tsx
const Landing = lazy(() => import('./pages/Landing'));
// Removed Auth and VerifyOTPScreen as they are replaced by Login.tsx
const Sanctuary = lazy(() => import('./pages/Sanctuary').then(module => ({ default: module.Sanctuary })));

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Route that redirects to Sanctuary if already logged in
const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
      return <LoadingFallback />;
    }

    if (isAuthenticated) {
      return <Navigate to="/sanctuary" replace />;
    }

    return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Public Routes - Wrapped to redirect if already auth */}
        <Route path="/" element={<PublicOnlyRoute><Landing /></PublicOnlyRoute>} />

        {/* New Login Component Handles Auth, Register, and Verification */}
        <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />

        {/* Protected Routes */}
        <Route
          path="/sanctuary"
          element={
            <ProtectedRoute>
              <BiometricGuard>
                <Sanctuary />
              </BiometricGuard>
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

const App: React.FC = () => {
  useSecurity();

  // Offline Ghost Logic: Schedule notifications on background, clear on foreground
  React.useEffect(() => {
      let listener: any;

      const initGhostService = async () => {
          try {
              listener = await CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
                  try {
                      if (!isActive) {
                          // App went to background: Schedule the ghosts
                          const userInfo = localStorage.getItem('userInfo');
                          if (userInfo) {
                              const user = JSON.parse(userInfo);
                              await scheduleGhostNotifications(user).catch(e => console.warn("Ghost schedule failed", e));
                          }
                      } else {
                          // App came to foreground: Clear pending ghosts (because they are here!)
                          await clearGhostNotifications().catch(e => console.warn("Ghost clear failed", e));
                      }
                  } catch (innerError) {
                      console.warn("Ghost listener error", innerError);
                  }
              });

              // Also clear on initial mount (if opening from notification)
              await clearGhostNotifications().catch(() => {});
          } catch (e) {
              console.warn("Ghost service init failed", e);
          }
      };

      initGhostService();

      return () => {
          if (listener) listener.remove();
      };
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <EncryptionProvider>
          {/* SyncProvider is independent and provides socket infrastructure */}
          <SyncProvider>
            {/* ThemeProvider manages state but also consumes Sync via Bridge */}
            <ThemeProvider>
               {/* Bridge connects Sync events to Theme updates */}
               <SyncBridge />
               <Router>
                <AppContainer>
                  <AppRoutes />
                  <Toaster position="top-center" reverseOrder={false} />
                </AppContainer>
              </Router>
            </ThemeProvider>
          </SyncProvider>
        </EncryptionProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
