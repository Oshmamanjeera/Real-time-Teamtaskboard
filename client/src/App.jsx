import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { BoardListPage } from './pages/BoardListPage.jsx';
import { BoardDetailPage } from './pages/BoardDetailPage.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex flex-col justify-center items-center">
        <div className="animate-spin text-3xl mb-2">🌸</div>
        <span className="font-heading text-sm text-[#7A5A50] font-bold">Waking up Kumo-chan...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <SocketProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route
                path="/boards"
                element={
                  <ProtectedRoute>
                    <BoardListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/boards/:boardId"
                element={
                  <ProtectedRoute>
                    <BoardDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/boards" replace />} />
            </Routes>
          </SocketProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

