'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();

      if (data.success) {
        setUser(data.user);
      } else {
        setUser(null);

        if (data.suspended) {
          toast.error(data.message);
          router.push('/login');
        }
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const safeRedirect = (target, fallback = '/dashboard') => {
    if (typeof target !== 'string' || !target.startsWith('/')) return fallback;
    if (target.startsWith('//')) return fallback;
    return target;
  };

  const login = async (email, password, callbackUrl) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        setUser(data.user);
        router.push(safeRedirect(callbackUrl));
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      return { success: false, message: 'Something went wrong' };
    }
  };

  const adminLogin = async (email, password) => {
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        setUser(data.user);
        router.push('/admin');
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      return { success: false, message: 'Something went wrong' };
    }
  };

  const register = async (name, email, password, callbackUrl) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (data.success) {
        setUser(data.user);
        router.push(safeRedirect(callbackUrl));
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      return { success: false, message: 'Something went wrong' };
    }
  };


  const updateUser = (partial) => {
    setUser((current) => (current ? { ...current, ...partial } : current));
  };

  const logout = async () => {
    const wasAdmin = user?.role === 'admin';

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      router.push(wasAdmin ? '/admin/login' : '/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        adminLogin,
        register,
        logout,
        checkAuth,
        updateUser,
      }}
    >
      {children}
      <Toaster position="top-center" />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
