import React, { createContext, useContext, useState, useEffect } from 'react';

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

const DEFAULT_MODULES: ModuleItem[] = [
  {
    id: 'm0',
    nome: 'Semiologia Geral',
    desc: 'Anamnese, sinais vitais e exame físico segmentar',
    color: '#2A78D6',
    img: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?w=600&h=400&fit=crop&q=70',
    lessons: [
      { id: 'les_1', titulo: 'Aula 1: Introdução ao Exame Físico', prof: 'Prof. Dr. Sérgio Amaral', duracao: '45 min', videoUrl: 'http://localhost:3001/uploads/videos/aula1_semiologia.mp4' },
      { id: 'les_2', titulo: 'Aula 2: Sinais Vitais e Antropometria', prof: 'Profa. Dra. Helena Castro', duracao: '50 min', videoUrl: 'http://localhost:3001/uploads/videos/aula2_sinais.mp4' },
      { id: 'les_3', titulo: 'Aula 3: Anamnese por Aparelhos', prof: 'Prof. Dr. Luís Prado', duracao: '55 min', videoUrl: 'http://localhost:3001/uploads/videos/aula1_semiologia.mp4' },
      { id: 'les_4', titulo: 'Aula 4: Inspeção Geral e Pele', prof: 'Profa. Dra. Paula Reis', duracao: '40 min', videoUrl: 'http://localhost:3001/uploads/videos/aula2_sinais.mp4' },
    ]
  },
  {
    id: 'm1',
    nome: 'Fisiologia Humana',
    desc: 'Sistemas cardiovascular, respiratório e renal',
    color: '#eb6834',
    img: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&h=400&fit=crop&q=70',
    lessons: [
      { id: 'les_5', titulo: 'Aula 1: Potencial de Ação e Sinapses', prof: 'Prof. Dr. Sérgio Amaral', duracao: '50 min', videoUrl: 'http://localhost:3001/uploads/videos/aula1_semiologia.mp4' },
      { id: 'les_6', titulo: 'Aula 2: Fisiologia Cardíaca', prof: 'Profa. Dra. Helena Castro', duracao: '45 min', videoUrl: 'http://localhost:3001/uploads/videos/aula2_sinais.mp4' },
      { id: 'les_7', titulo: 'Aula 3: Hemodinâmica e Pressão Arterial', prof: 'Prof. Dr. Luís Prado', duracao: '50 min', videoUrl: 'http://localhost:3001/uploads/videos/aula1_semiologia.mp4' },
      { id: 'les_8', titulo: 'Aula 4: Fisiologia Respiratória', prof: 'Profa. Dra. Paula Reis', duracao: '40 min', videoUrl: 'http://localhost:3001/uploads/videos/aula2_sinais.mp4' },
    ]
  },
  {
    id: 'm2',
    nome: 'Bioquímica Médica',
    desc: 'Metabolismo, enzimas e correlações clínicas',
    color: '#1baf7a',
    img: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=600&h=400&fit=crop&q=70',
    lessons: [
      { id: 'les_9', titulo: 'Aula 1: Estrutura de Proteínas e Enzimas', prof: 'Prof. Dr. Marcos Viana', duracao: '45 min', videoUrl: 'http://localhost:3001/uploads/videos/aula1_semiologia.mp4' },
      { id: 'les_10', titulo: 'Aula 2: Glicólise e Ciclo de Krebs', prof: 'Profa. Dra. Rita Aguiar', duracao: '50 min', videoUrl: 'http://localhost:3001/uploads/videos/aula2_sinais.mp4' },
    ]
  },
  {
    id: 'm3',
    nome: 'Atenção Primária',
    desc: 'Estratégia Saúde da Família e prevenção',
    color: '#eda100',
    img: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&h=400&fit=crop&q=70',
    lessons: [
      { id: 'les_13', titulo: 'Aula 1: Princípios do SUS e ESF', prof: 'Prof. Dr. Fernando Mendes', duracao: '40 min', videoUrl: 'http://localhost:3001/uploads/videos/aula1_semiologia.mp4' },
      { id: 'les_14', titulo: 'Aula 2: Abordagem Familiar e Genograma', prof: 'Profa. Dra. Camila Dantas', duracao: '55 min', videoUrl: 'http://localhost:3001/uploads/videos/aula2_sinais.mp4' },
    ]
  }
];

const DEFAULT_ALERTS: CourseAlert[] = [
  {
    id: 'alt_1',
    title: '📢 Novo Conteúdo Cadastrado',
    message: 'A coordenação da universidade postou novos materiais e videoaulas no módulo de Fisiologia Humana.',
    date: 'Hoje, 10:30',
    moduleName: 'Fisiologia Humana',
    unread: true
  }
];

const DEFAULT_RETAKES: RetakeRequest[] = [
  {
    id: 'ret_1',
    studentName: 'Lucas Oliveira',
    moduleName: 'Fisiologia Humana',
    score: 4.5,
    date: 'Hoje, 14:20',
    status: 'PENDENTE'
  }
];

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export const CourseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modules, setModules] = useState<ModuleItem[]>(() => {
    const saved = localStorage.getItem('facilita_course_modules');
    return saved ? JSON.parse(saved) : DEFAULT_MODULES;
  });

  const [alerts, setAlerts] = useState<CourseAlert[]>(() => {
    const saved = localStorage.getItem('facilita_course_alerts');
    return saved ? JSON.parse(saved) : DEFAULT_ALERTS;
  });

  const [retakeRequests, setRetakeRequests] = useState<RetakeRequest[]>(() => {
    const saved = localStorage.getItem('facilita_retake_requests');
    return saved ? JSON.parse(saved) : DEFAULT_RETAKES;
  });

  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('facilita_completed_lessons');
    return saved ? JSON.parse(saved) : ['les_1'];
  });

  useEffect(() => {
    localStorage.setItem('facilita_course_modules', JSON.stringify(modules));
  }, [modules]);

  useEffect(() => {
    localStorage.setItem('facilita_course_alerts', JSON.stringify(alerts));
  }, [alerts]);

  useEffect(() => {
    localStorage.setItem('facilita_retake_requests', JSON.stringify(retakeRequests));
  }, [retakeRequests]);

  useEffect(() => {
    localStorage.setItem('facilita_completed_lessons', JSON.stringify(completedLessonIds));
  }, [completedLessonIds]);

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
