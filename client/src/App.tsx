import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppContainer } from './components/layout/AppContainer';
import { Landing } from './pages/Landing';
import { Auth } from './pages/Auth';
import { VerifyOTPScreen } from './pages/VerifyOTPScreen';
import { Sanctuary } from './pages/Sanctuary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { EncryptionProvider } from './context/EncryptionContext';

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black text-white font-serif">
        Loading Sanctuary...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Auth />} />
      <Route path="/verify" element={<VerifyOTPScreen />} />
      
      {/* Protected Routes */}
      <Route
        path="/sanctuary"
        element={
          <ProtectedRoute>
            <Sanctuary />
          </ProtectedRoute>
        }
      />
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  // --- Security: Disable Inspect & Right Click ---
  React.useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block F12
      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }

      // Block Ctrl+Shift+I/J/C, Ctrl+U, Cmd+Option+I/J/C/U
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();

        // Ctrl+U or Cmd+U (View Source)
        if (key === 'u') {
          e.preventDefault();
          return;
        }

        // Ctrl+Shift+...
        if (e.shiftKey) {
          if (key === 'i' || key === 'j' || key === 'c') {
             e.preventDefault();
             return;
          }
        }

        // Cmd+Option+... (Mac)
        if (e.altKey) {
          if (key === 'i' || key === 'j' || key === 'c' || key === 'u') {
            e.preventDefault();
            return;
          }
        }
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <AuthProvider>
      <EncryptionProvider>
        <ThemeProvider>
          <Router>
            <AppContainer>
              <AppRoutes />
            </AppContainer>
          </Router>
        </ThemeProvider>
      </EncryptionProvider>
    </AuthProvider>
  );
};

export default App;