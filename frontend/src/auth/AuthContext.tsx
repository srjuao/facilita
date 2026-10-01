import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import api from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  completedModules: string[];
  markModuleCompleted: (moduleName: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState<boolean>(true);
  
  // Matérias Concluídas salvas no LocalStorage por Aluno
  const [completedModules, setCompletedModules] = useState<string[]>(() => {
    const saved = localStorage.getItem('facilita_completed_modules');
    return saved ? JSON.parse(saved) : [];
  });

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

  const markModuleCompleted = (moduleName: string) => {
    if (!completedModules.includes(moduleName)) {
      const updated = [...completedModules, moduleName];
      setCompletedModules(updated);
      localStorage.setItem('facilita_completed_modules', JSON.stringify(updated));
    }
  };

  const login = async (email: string) => {
    const res = await api.post('/auth/login', { email, password: 'facilita2026' });
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

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, completedModules, markModuleCompleted }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
};
