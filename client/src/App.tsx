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
import { notificationService } from './services/notificationService';
import { LiquidGlassDefs } from './design/LiquidGlass';
import { requestPermission as requestNotificationPermission } from './services/notifications';
import { userService } from './services/userService';
import { backgroundService } from './services/backgroundService';
import { followUpCheckIns } from './services/followUpCheckIns';

// Lazy Load Pages
// Note: We use the default export from the new Landing.tsx
const Landing = lazy(() => import('./pages/Landing'));
// Removed Auth and VerifyOTPScreen as they are replaced by Login.tsx
const Sanctuary = lazy(() => import('./pages/Sanctuary').then(module => ({ default: module.Sanctuary })));
const PrivacyPolicyPage = lazy(() => import('./pages/Legal').then(m => ({ default: m.PrivacyPolicyPage })));
const TermsPage = lazy(() => import('./pages/Legal').then(m => ({ default: m.TermsPage })));

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
      <LiquidGlassDefs />
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

        {/* Legal (public, linked from sign-up, footer and Settings) */}
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

const App: React.FC = () => {
  useSecurity();

  // Offline Ghost Logic & Data Sync
  React.useEffect(() => {
      let listener: any;
      // Offline queues have their own backoff gate (services/offlineQueue.ts), so these calls are cheap no-ops
      // while waiting; 'online' forces one immediate try because the network just came back.
      const syncQueues = (force = false) => {
          userService.syncOfflineMoods(force).catch(() => {});
          userService.syncOfflineDiary(force).catch(() => {});
          if (localStorage.getItem('userInfo')) followUpCheckIns.sync().catch(() => {}); // 7.4 check-ins (native only)
      };
      const onOnline = () => syncQueues(true);

      const initServices = async () => {
          try {
              // 1. Ghost Service (Notifications)
              listener = await CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
                  try {
                      if (!isActive) {
                          // Background: Schedule ghosts
                          const userInfo = localStorage.getItem('userInfo');
                          if (userInfo) {
                              const user = JSON.parse(userInfo);
                              await scheduleGhostNotifications(user).catch(e => console.warn("Ghost schedule failed", e));
                          }
                      } else {
                          // Foreground: Clear ghosts & SYNC DATA
                          await clearGhostNotifications().catch(e => console.warn("Ghost clear failed", e));
                          syncQueues();
                      }
                  } catch (innerError) {
                      console.warn("App state listener error", innerError);
                  }
              });

              // 2. Initial Checks on Mount
              await clearGhostNotifications().catch(() => {});
              syncQueues();
              backgroundService.init().catch(e => console.warn("Background init failed", e));

              // 3. Notification Setup (Channels & Permissions)
              try {
                  await requestNotificationPermission();
                  await notificationService.init(); // channels + restore opted-in daily reminders
              } catch (e) {
                  console.error('❌ Notification setup failed:', e);
              }

              // 4. Web Online Listener (Fallback for non-Capacitor)
              window.addEventListener('online', onOnline);

          } catch (e) {
              console.warn("Service init failed", e);
          }
      };

      initServices();

      return () => {
          if (listener) listener.remove();
          window.removeEventListener('online', onOnline); // was an anonymous fn → never removed
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
