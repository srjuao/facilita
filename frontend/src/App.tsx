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
import { InstitutionWorkspace } from './pages/institution/InstitutionWorkspace';
import { PaidCourses } from './pages/institution/PaidCourses';
import { StaffAccounts } from './pages/institution/StaffAccounts';
import { InstitutionFinancial } from './pages/institution/InstitutionFinancial';
import { Assessments } from './pages/institution/Assessments';

// SuperAdmin Pages
import { SuperAdminOverview } from './pages/superadmin/SuperAdminOverview';
import { SuperAdminTenants } from './pages/superadmin/SuperAdminTenants';
import { SuperAdminCourses } from './pages/superadmin/SuperAdminCourses';
import { SuperAdminFinancial } from './pages/superadmin/SuperAdminFinancial';
import { SuperAdminLogin } from './pages/superadmin/SuperAdminLogin';
import { SuperAdminPlans } from './pages/superadmin/SuperAdminPlans';
import { SuperAdminLeads } from './pages/superadmin/SuperAdminLeads';
import { SuperAdminAccount } from './pages/superadmin/SuperAdminAccount';

export const AppContent: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const [currentView, setCurrentView] = useState<string>('default');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [selectedPaidCourseId, setSelectedPaidCourseId] = useState('');
  const [lessonReturnView, setLessonReturnView] = useState('al-materias');

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando FacilitaEstudos...</div>;
  }

  const isSuperAdminPortal = window.location.hostname === 'app.facilitaestudos.com.br';
  if (!user) return isSuperAdminPortal ? <SuperAdminLogin /> : <Login />;
  if (isSuperAdminPortal && user.role !== 'superadmin') return <main className="portal-denied"><ShieldMessage onExit={logout} /></main>;
  if (!isSuperAdminPortal && user.role === 'superadmin') return <SuperAdminLogin />;

  const handleOpenLesson = (lessonId: string) => {
    setLessonReturnView(activeView === 'al-paid-course' ? 'al-paid-course' : 'al-materias');
    setSelectedLessonId(lessonId);
    setCurrentView('al-aula');
  };

  // Roteamento padrão por papel caso não haja view selecionada
  const activeView = currentView === 'default'
    ? user.role === 'superadmin' ? 'sa-overview' : user.role === 'coord' ? 'co-dash' : ['professor', 'staff'].includes(user.role) ? 'co-notices' : 'al-inicio'
    : currentView;

  const renderView = () => {
    if (activeView === 'co-staff') return <StaffAccounts />;
    if (activeView === 'co-finance' || activeView === 'al-finance') return <InstitutionFinancial />;
    if (activeView === 'co-sales' || activeView === 'al-store') return <PaidCourses onOpenCourse={courseId => { setSelectedPaidCourseId(courseId); setCurrentView('al-paid-course'); }} />;
    if (activeView === 'al-paid-course') return <CourseRecords title="Conteúdo do curso" kind="modules" courseId={selectedPaidCourseId} onOpenLesson={handleOpenLesson} onShowCatalog={() => setCurrentView('al-store')} onOpenExams={user.tenant?.plan?.provas === false ? undefined : () => setCurrentView('al-course-exams')} />;
    if (activeView === 'al-course-exams') return <Assessments courseId={selectedPaidCourseId} />;
    const sections = { 'co-notices': 'notices', 'co-subs': 'classes', 'co-team': 'team', 'co-chat': 'chat', 'al-notices': 'notices', 'al-classes': 'classes', 'al-chat': 'chat' } as const;
    if (activeView in sections) return <InstitutionWorkspace section={sections[activeView as keyof typeof sections]} />;
    if (['professor', 'staff'].includes(user.role) && ((activeView === 'co-gestao' && !user.permissions?.includes('content.manage')) || (activeView === 'co-alunos' && !user.permissions?.includes('students.manage')))) return <section className="unit-setup"><div className="card"><h1>Acesso não autorizado</h1><p>A coordenação ainda não liberou esta função para sua conta.</p></div></section>;
    const plan = user.role !== 'superadmin' ? user.tenant?.plan : null;
    if ((activeView === 'al-ia' && plan?.ia === false) || (['al-provas', 'co-provas'].includes(activeView) && plan?.provas === false) || (activeView === 'al-aula' && plan?.videoAulas === false)) return <section className="unit-setup"><div className="card"><h1>Recurso não incluído no plano</h1><p>Consulte a coordenação da instituição sobre os recursos contratados.</p><button className="ghost" onClick={() => setCurrentView('default')}>Voltar ao início</button></div></section>;
    if (['al-provas', 'co-provas'].includes(activeView)) return <Assessments />;
    const records: Record<string, { title: string; kind: 'modules' | 'exams' | 'alerts' | 'live' | 'empty' }> = {
      'co-subs': { title: 'Turmas', kind: 'empty' },
      'co-alertas': { title: 'Alertas', kind: 'alerts' },
      'co-live': { title: 'Alunos online', kind: 'live' },
      'co-provas': { title: 'Provas e simulados', kind: 'exams' },
      'co-conteudo': { title: 'Conteúdo', kind: 'modules' },
      'co-relatorio': { title: 'Relatórios', kind: 'empty' },
      'al-inicio': { title: 'Meu curso', kind: 'modules' },
      'al-periodos': { title: 'Períodos e matérias', kind: 'modules' },
      'al-materias': { title: 'Matérias', kind: 'modules' },
      'al-provas': { title: 'Provas', kind: 'exams' },
      'al-flash': { title: 'Flashcards', kind: 'empty' },
      'al-plano': { title: 'Plano de estudos', kind: 'empty' }
    };
    if (records[activeView]) return <CourseRecords {...records[activeView]} onOpenLesson={user.role === 'aluno' ? handleOpenLesson : undefined} onShowCatalog={user.role === 'aluno' ? () => setCurrentView('al-store') : undefined} />;
    switch (activeView) {
      // Aluno
      case 'al-inicio': return <StudentHome onNavigate={setCurrentView} />;
      case 'al-periodos': return <StudentPeriods onNavigateView={setCurrentView} onNavigateLesson={handleOpenLesson} />;
      case 'al-materias': return <StudentSubjects onOpenLesson={handleOpenLesson} />;
      case 'al-aula': return <LessonPlayer lessonId={selectedLessonId} onBack={() => setCurrentView(lessonReturnView)} />;
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
      case 'co-ucs': return <ContentManager />;
      case 'co-conteudo': return <CoordContent />;
      case 'co-gestao': return <ContentManager />;
      case 'co-setup': return <CoordUnitSetup />;
      case 'co-relatorio': return <CoordReport />;

      // SuperAdmin
      case 'sa-overview': return <SuperAdminOverview onNavigate={setCurrentView} />;
      case 'sa-tenants': return <SuperAdminTenants />;
      case 'sa-courses': return <SuperAdminCourses />;
      case 'sa-fin': return <SuperAdminFinancial onNavigate={setCurrentView} />;
      case 'sa-plans': return <SuperAdminPlans />;
      case 'sa-leads': return <SuperAdminLeads />;
      case 'sa-account': return <SuperAdminAccount />;

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
