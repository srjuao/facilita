import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import api from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState<boolean>(true);
  useEffect(() => {
    const tenant = user?.role !== 'superadmin' ? user?.tenant : undefined;
    if (!tenant) return;
    document.title = tenant.browserTitle || `${tenant.nome} | Facilita Estudos`;
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.appendChild(icon); }
    icon.href = tenant.faviconUrl || '/facilita-estudos-mark.svg';
    if (/^#[0-9a-f]{6}$/i.test(tenant.primaryColor)) {
      document.documentElement.style.setProperty('--accent', tenant.primaryColor);
      document.documentElement.style.setProperty('--accent-ink', tenant.primaryColor);
    }
    return () => {
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--accent-ink');
    };
  }, [user]);
  

  useEffect(() => {
    if (token) {
      api.get('/auth/me')
        .then(res => {
          setUser(res.data);
        })
        .catch(() => {
          logout();
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [token]);


  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    const response = await api.get('/auth/me');
    setUser(response.data);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
};
