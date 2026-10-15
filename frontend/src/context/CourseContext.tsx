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

export interface CourseAlert {
  id: string;
  title: string;
  message: string;
  date: string;
  moduleName: string;
  unread: boolean;
}

export interface RetakeRequest {
  id: string;
  studentName: string;
  moduleName: string;
  score: number;
  date: string;
  status: 'PENDENTE' | 'LIBERADO';
}

interface CourseContextType {
  modules: ModuleItem[];
  alerts: CourseAlert[];
  retakeRequests: RetakeRequest[];
  completedLessonIds: string[];
  addLesson: (moduleId: string, lesson: Omit<LessonItem, 'id'>) => void;
  deleteLesson: (moduleId: string, lessonId: string) => void;
  markAlertRead: (alertId: string) => void;
  clearAllAlerts: () => void;
  requestRetake: (studentName: string, moduleName: string, score: number) => void;
  approveRetake: (requestId: string) => void;
  isRetakeUnlocked: (studentName: string, moduleName: string) => boolean;
  markLessonCompleted: (lessonId: string) => void;
  toggleLessonCompleted: (lessonId: string) => void;
  isLessonCompleted: (lessonId: string) => boolean;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export const CourseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [alerts, setAlerts] = useState<CourseAlert[]>([]);
  const [retakeRequests, setRetakeRequests] = useState<RetakeRequest[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    setModules([]); setAlerts([]); setRetakeRequests([]); setCompletedLessonIds([]);
    if (user?.courseId) {
      api.get('/courses/' + user.courseId).then(response => {
        if (active) setModules(response.data.modules.map((module: any) => ({ ...module, lessons: module.lessons || [] })));
      }).catch(() => undefined);
    }
    return () => { active = false; };
  }, [user?.id, user?.courseId]);

  const addLesson = (moduleId: string, lessonData: Omit<LessonItem, 'id'>) => {
    const newLessonId = `les_${Date.now()}`;
    const newLesson: LessonItem = {
      ...lessonData,
      id: newLessonId
    };

    let targetModuleName = 'Curso';

    const updatedModules = modules.map(m => {
      if (m.id === moduleId || m.nome.toLowerCase() === moduleId.toLowerCase()) {
        targetModuleName = m.nome;
        return {
          ...m,
          lessons: [...m.lessons, newLesson]
        };
      }
      return m;
    });

    setModules(updatedModules);

    // Criar Alerta para os alunos
    const newAlert: CourseAlert = {
      id: `alt_${Date.now()}`,
      title: `🔔 Nova Aula em ${targetModuleName}`,
      message: `O administrador da faculdade adicionou a aula "${newLesson.titulo}" (${newLesson.duracao}) ministrada por ${newLesson.prof}.`,
      date: 'Agora mesmo',
      moduleName: targetModuleName,
      unread: true
    };

    setAlerts(prev => [newAlert, ...prev]);
  };

  const deleteLesson = (moduleId: string, lessonId: string) => {
    const updatedModules = modules.map(m => {
      if (m.id === moduleId) {
        return {
          ...m,
          lessons: m.lessons.filter(l => l.id !== lessonId)
        };
      }
      return m;
    });
    setModules(updatedModules);
  };

  const markAlertRead = (alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, unread: false } : a));
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };

  const requestRetake = (studentName: string, moduleName: string, score: number) => {
    const existingIndex = retakeRequests.findIndex(r => r.studentName === studentName && r.moduleName === moduleName);
    if (existingIndex !== -1) {
      const updated = [...retakeRequests];
      updated[existingIndex] = {
        ...updated[existingIndex],
        score,
        status: 'PENDENTE',
        date: 'Agora mesmo'
      };
      setRetakeRequests(updated);
    } else {
      const newReq: RetakeRequest = {
        id: `ret_${Date.now()}`,
        studentName,
        moduleName,
        score,
        date: 'Agora mesmo',
        status: 'PENDENTE'
      };
      setRetakeRequests(prev => [newReq, ...prev]);
    }
  };

  const approveRetake = (requestId: string) => {
    let studentName = '';
    let moduleName = '';

    const updated = retakeRequests.map(r => {
      if (r.id === requestId) {
        studentName = r.studentName;
        moduleName = r.moduleName;
        return { ...r, status: 'LIBERADO' as const };
      }
      return r;
    });
    setRetakeRequests(updated);

    // Notificar o aluno
    const approvalAlert: CourseAlert = {
      id: `alt_${Date.now()}`,
      title: `🔓 Nova Tentativa de Prova Liberada!`,
      message: `A Coordenação da Faculdade liberou para você refazer a Prova Final de ${moduleName}. Boa sorte!`,
      date: 'Agora mesmo',
      moduleName,
      unread: true
    };
    setAlerts(prev => [approvalAlert, ...prev]);
  };

  const isRetakeUnlocked = (studentName: string, moduleName: string) => {
    const req = retakeRequests.find(r => r.studentName === studentName && r.moduleName === moduleName);
    return req ? req.status === 'LIBERADO' : false;
  };

  const markLessonCompleted = (lessonId: string) => {
    if (!completedLessonIds.includes(lessonId)) {
      setCompletedLessonIds(prev => [...prev, lessonId]);
    }
  };

  const toggleLessonCompleted = (lessonId: string) => {
    if (completedLessonIds.includes(lessonId)) {
      setCompletedLessonIds(prev => prev.filter(id => id !== lessonId));
    } else {
      setCompletedLessonIds(prev => [...prev, lessonId]);
    }
  };

  const isLessonCompleted = (lessonId: string) => {
    return completedLessonIds.includes(lessonId);
  };

  return (
    <CourseContext.Provider 
      value={{ 
        modules, 
        alerts, 
        retakeRequests, 
        completedLessonIds,
        addLesson, 
        deleteLesson, 
        markAlertRead, 
        clearAllAlerts, 
        requestRetake, 
        approveRetake, 
        isRetakeUnlocked,
        markLessonCompleted,
        toggleLessonCompleted,
        isLessonCompleted
      }}
    >
      {children}
    </CourseContext.Provider>
  );
};

export const useCourse = () => {
  const context = useContext(CourseContext);
  if (!context) throw new Error('useCourse deve ser usado dentro de CourseProvider');
  return context;
};
