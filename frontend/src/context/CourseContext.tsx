import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import api from '../api/client';

export interface LessonItem {
  id: string;
  titulo: string;
  prof: string;
  duracao: string;
  videoUrl: string;
  pdfUrl?: string;
  desc?: string;
}

export interface ModuleItem {
  id: string;
  nome: string;
  desc: string;
  color: string;
  aulasCount?: number;
  img?: string;
  lessons: LessonItem[];
}

interface CourseContextType {
  modules: ModuleItem[];
  loading: boolean;
  error: string;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export const CourseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setModules([]); setError(''); setLoading(Boolean(user?.courseId));
    if (user?.courseId) {
      api.get('/courses/' + encodeURIComponent(user.courseId)).then(response => {
        if (active) setModules((response.data.modules || []).map((module: ModuleItem) => ({ ...module, lessons: module.lessons || [] })));
      }).catch(() => { if (active) setError('Não foi possível carregar os conteúdos do curso.'); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [user?.id, user?.courseId]);

  return (
    <CourseContext.Provider value={{ modules, loading, error }}>
      {children}
    </CourseContext.Provider>
  );
};

export const useCourse = () => {
  const context = useContext(CourseContext);
  if (!context) throw new Error('useCourse deve ser usado dentro de CourseProvider');
  return context;
};
