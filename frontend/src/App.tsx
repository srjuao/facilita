import React, { useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { Login } from './pages/Login';
import { Sidebar } from './components/Sidebar';
import { CourseRecords } from './components/CourseRecords';
import { ContentManager } from './pages/coord/ContentManager';

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
import { CoordUnitSetup } from './pages/coord/CoordUnitSetup';

// SuperAdmin Pages
import { SuperAdminOverview } from './pages/superadmin/SuperAdminOverview';
import { SuperAdminTenants } from './pages/superadmin/SuperAdminTenants';
import { SuperAdminCourses } from './pages/superadmin/SuperAdminCourses';
import { SuperAdminFinancial } from './pages/superadmin/SuperAdminFinancial';
import { SuperAdminLogin } from './pages/superadmin/SuperAdminLogin';

export const AppContent: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const [currentView, setCurrentView] = useState<string>('default');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('les_1');

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando FacilitaEstudos...</div>;
  }

  const isSuperAdminPortal = window.location.hostname === 'app.facilitaestudos.com.br';
  if (!user) return isSuperAdminPortal ? <SuperAdminLogin /> : <Login />;
  if (isSuperAdminPortal && user.role !== 'superadmin') return <main className="portal-denied"><ShieldMessage onExit={logout} /></main>;
  if (!isSuperAdminPortal && user.role === 'superadmin') return <SuperAdminLogin />;

  const handleOpenLesson = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setCurrentView('al-aula');
  };

  // Roteamento padrão por papel caso não haja view selecionada
  const activeView = currentView === 'default'
    ? user.role === 'superadmin' ? 'sa-overview' : user.role === 'coord' ? 'co-dash' : user.role === 'professor' ? 'co-gestao' : 'al-inicio'
    : currentView;

  const renderView = () => {
    const records: Record<string, { title: string; kind: 'modules' | 'exams' | 'alerts' | 'live' | 'empty' }> = {
      'co-subs': { title: 'Turmas', kind: 'empty' },
      'co-alertas': { title: 'Alertas', kind: 'alerts' },
      'co-live': { title: 'Alunos online', kind: 'live' },
      'co-provas': { title: 'Provas e simulados', kind: 'exams' },
      'co-ucs': { title: 'Períodos e matérias', kind: 'modules' },
      'co-conteudo': { title: 'Conteúdo', kind: 'modules' },
      'co-relatorio': { title: 'Relatórios', kind: 'empty' },
      'al-inicio': { title: 'Meu curso', kind: 'modules' },
      'al-periodos': { title: 'Períodos e matérias', kind: 'modules' },
      'al-materias': { title: 'Matérias', kind: 'modules' },
      'al-provas': { title: 'Provas', kind: 'exams' },
      'al-flash': { title: 'Flashcards', kind: 'empty' },
      'al-plano': { title: 'Plano de estudos', kind: 'empty' }
    };
    if (records[activeView]) return <CourseRecords {...records[activeView]} />;
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
      case 'co-dash': return <CoordDashboard onNavigate={setCurrentView} />;
      case 'co-alunos': return <CoordStudents />;
      case 'co-subs': return <CoordSubs />;
      case 'co-alertas': return <CoordAlerts />;
      case 'co-live': return <CoordLive />;
      case 'co-provas': return <CoordExams />;
      case 'co-ucs': return <CoordUCs />;
      case 'co-conteudo': return <CoordContent />;
      case 'co-gestao': return <ContentManager />;
      case 'co-setup': return <CoordUnitSetup />;
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

const ShieldMessage: React.FC<{ onExit: () => void }> = ({ onExit }) => <section className="portal-denied-card"><p className="eyebrow">ACESSO RESTRITO</p><h1>Este é o painel de superadmin.</h1><p className="muted">Use uma conta de superadmin para continuar.</p><button className="ghost" onClick={onExit}>Sair</button></section>;
