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
import { useSecurity } from './hooks/useSecurity';

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
  useSecurity();

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