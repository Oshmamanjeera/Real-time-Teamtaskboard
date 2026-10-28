import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('kawaii_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [accessToken, setAccessToken] = useState(() => {
    return localStorage.getItem('kawaii_token') || null;
  });

  const [loading, setLoading] = useState(true);

  const saveAuth = useCallback((newUser, newToken) => {
    setUser(newUser);
    setAccessToken(newToken);
    if (newUser) localStorage.setItem('kawaii_user', JSON.stringify(newUser));
    else localStorage.removeItem('kawaii_user');
    if (newToken) localStorage.setItem('kawaii_token', newToken);
    else localStorage.removeItem('kawaii_token');
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    }
    saveAuth(null, null);
  }, [saveAuth]);

  // Authenticated fetch helper
  const apiFetch = useCallback(async (url, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    let response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    // If 401 Unauthorized, try refresh token once
    if (response.status === 401 && !url.includes('/api/auth/')) {
      try {
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          saveAuth(refreshData.user, refreshData.accessToken);
          headers.set('Authorization', `Bearer ${refreshData.accessToken}`);
          // Retry original request
          response = await fetch(url, {
            ...options,
            headers,
            credentials: 'include',
          });
        } else {
          logout();
        }
      } catch {
        logout();
      }
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error?.message || 'Request failed');
      error.status = response.status;
      error.code = data.error?.code || 'UNKNOWN_ERROR';
      error.data = data;
      throw error;
    }
    return data;
  }, [accessToken, saveAuth, logout]);

  // Initial check on mount
  useEffect(() => {
    async function checkAuth() {
      if (accessToken) {
        try {
          const data = await apiFetch('/api/auth/me');
          setUser(data.user);
        } catch {
          // If expired and refresh fails, user is cleared in apiFetch
        }
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error?.message || 'Login failed');
      err.status = res.status;
      err.code = data.error?.code;
      throw err;
    }
    saveAuth(data.user, data.accessToken);
    return data;
  };

  const register = async (email, password, name, avatarColor) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, avatarColor }),
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error?.message || 'Registration failed');
      err.status = res.status;
      err.code = data.error?.code;
      throw err;
    }
    saveAuth(data.user, data.accessToken);
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, login, register, logout, loading, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

