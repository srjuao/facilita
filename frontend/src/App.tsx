import React, { useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { Login } from './pages/Login';
import { Sidebar } from './components/Sidebar';

// Student Pages
import { StudentHome } from './pages/student/StudentHome';
import { AIChat } from './pages/student/AIChat';
import { StudentPeriods } from './pages/student/StudentPeriods';
import { StudentSubjects } from './pages/student/StudentSubjects';
import { StudentFlashcards } from './pages/student/StudentFlashcards';
import { StudentExams } from './pages/student/StudentExams';
import { StudentStudyPlan } from './pages/student/StudentStudyPlan';
import { StudentProfile } from './pages/student/StudentProfile';
import { LessonPlayer } from './pages/student/LessonPlayer';

// Coord Pages
import { CoordDashboard } from './pages/coord/CoordDashboard';
import { CoordStudents } from './pages/coord/CoordStudents';
import { CoordSubs } from './pages/coord/CoordSubs';
import { CoordAlerts } from './pages/coord/CoordAlerts';
import { CoordLive } from './pages/coord/CoordLive';
import { CoordExams } from './pages/coord/CoordExams';
import { CoordUCs } from './pages/coord/CoordUCs';
import { CoordContent } from './pages/coord/CoordContent';
import { CoordReport } from './pages/coord/CoordReport';
import { CoordCourseManager } from './pages/coord/CoordCourseManager';

// SuperAdmin Pages
import { SuperAdminOverview } from './pages/superadmin/SuperAdminOverview';
import { SuperAdminTenants } from './pages/superadmin/SuperAdminTenants';
import { SuperAdminCourses } from './pages/superadmin/SuperAdminCourses';
import { SuperAdminFinancial } from './pages/superadmin/SuperAdminFinancial';

export const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<string>('default');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('les_1');

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando FacilitaEstudos...</div>;
  }

  if (!user) {
    return <Login />;
  }

  const handleOpenLesson = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setCurrentView('al-aula');
  };

  // Roteamento padrão por papel caso não haja view selecionada
  const activeView = currentView === 'default'
    ? user.role === 'superadmin' ? 'sa-overview' : user.role === 'coord' ? 'co-dash' : 'al-inicio'
    : currentView;

  const renderView = () => {
    switch (activeView) {
      // Aluno
      case 'al-inicio': return <StudentHome onNavigate={setCurrentView} />;
      case 'al-periodos': return <StudentPeriods onNavigateView={setCurrentView} onNavigateLesson={handleOpenLesson} />;
      case 'al-materias': return <StudentSubjects onOpenLesson={handleOpenLesson} />;
      case 'al-aula': return <LessonPlayer lessonId={selectedLessonId} onBack={() => setCurrentView('al-materias')} />;
      case 'al-plano': return <StudentStudyPlan />;
      case 'al-flash': return <StudentFlashcards />;
      case 'al-ia': return <AIChat />;
      case 'al-provas': return <StudentExams />;
      case 'al-perfil': return <StudentProfile />;

      // Coordenação
      case 'co-dash': return <CoordDashboard />;
      case 'co-alunos': return <CoordStudents />;
      case 'co-subs': return <CoordSubs />;
      case 'co-alertas': return <CoordAlerts />;
      case 'co-live': return <CoordLive />;
      case 'co-provas': return <CoordExams />;
      case 'co-ucs': return <CoordUCs />;
      case 'co-conteudo': return <CoordContent />;
      case 'co-gestao': return <CoordCourseManager />;
      case 'co-relatorio': return <CoordReport />;

      // SuperAdmin
      case 'sa-overview': return <SuperAdminOverview />;
      case 'sa-tenants': return <SuperAdminTenants />;
      case 'sa-courses': return <SuperAdminCourses />;
      case 'sa-fin': return <SuperAdminFinancial />;

      default:
        return <StudentHome onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="app">
      <Sidebar currentView={activeView} onNavigate={setCurrentView} />
      <main className="main">
        {renderView()}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return <AppContent />;
};
