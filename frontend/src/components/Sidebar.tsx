import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { WordMark } from './WordMark';
import { 
  LayoutDashboard, 
  Building2, 
  BookOpen, 
  DollarSign, 
  ArrowRight, 
  Users, 
  Layers, 
  AlertTriangle, 
  Radio, 
  FileText, 
  Calendar, 
  Home, 
  Target, 
  MessageSquare, 
  User, 
  LogOut,
  Sliders
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const { user, logout } = useAuth();

  if (!user) return null;

  const role = user.role;

  const NAVS: Record<string, Array<{ sec?: string; id?: string; label?: string; icon?: React.ReactNode }>> = {
    superadmin: [
      { sec: 'Plataforma' },
      { id: 'sa-overview', label: 'Visão geral', icon: <LayoutDashboard size={18} /> },
      { id: 'sa-tenants', label: 'Faculdades', icon: <Building2 size={18} /> },
      { id: 'sa-courses', label: 'Cursos', icon: <BookOpen size={18} /> },
      { id: 'sa-fin', label: 'Financeiro', icon: <DollarSign size={18} /> },
      { sec: 'Instituição selecionada' },
      { id: 'co-dash', label: 'Entrar na coordenação', icon: <ArrowRight size={18} /> },
    ],
    coord: [
      { sec: 'Acompanhamento' },
      { id: 'co-dash', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      { id: 'co-alunos', label: 'Alunos', icon: <Users size={18} /> },
      { id: 'co-subs', label: 'Turmas (SUBs)', icon: <Layers size={18} /> },
      { id: 'co-alertas', label: 'Alertas', icon: <AlertTriangle size={18} /> },
      { id: 'co-live', label: 'Ao vivo', icon: <Radio size={18} /> },
      { id: 'co-provas', label: 'Provas e simulados', icon: <FileText size={18} /> },
      { sec: 'Curso' },
      { id: 'co-ucs', label: 'Períodos e UCs', icon: <Calendar size={18} /> },
      { id: 'co-conteudo', label: 'Conteúdo', icon: <BookOpen size={18} /> },
      { id: 'co-gestao', label: 'Gestão Cursos & Aulas', icon: <Sliders size={18} /> },
    ],
    aluno: [
      { id: 'al-inicio', label: 'Início', icon: <Home size={18} /> },
      { id: 'al-periodos', label: 'Períodos', icon: <Calendar size={18} /> },
      { id: 'al-materias', label: 'Matérias', icon: <BookOpen size={18} /> },
      { id: 'al-plano', label: 'Plano de estudos', icon: <Target size={18} /> },
      { id: 'al-flash', label: 'Flash Cards', icon: <Layers size={18} /> },
      { id: 'al-ia', label: 'IA Tira-Dúvidas', icon: <MessageSquare size={18} /> },
      { id: 'al-provas', label: 'Provas', icon: <FileText size={18} /> },
      { id: 'al-perfil', label: 'Perfil', icon: <User size={18} /> },
    ]
  };

  const navItems = NAVS[role] || NAVS.aluno;
  const courseName = user.course?.nome || 'Medicina';
  const tenantName = user.tenant?.nome || 'UNIFAN';

  return (
    <aside className="side">
      <div className="wm-wrap">
        <div className="wm-mini">
          <WordMark courseName={courseName} />
        </div>
        <div className="wm-full">
          <WordMark courseName={courseName} />
        </div>
      </div>
      <div className="tenant">{tenantName}</div>

      <nav className="nav">
        {navItems.map((item, idx) => (
          item.sec ? (
            <div key={idx} className="sec">{item.sec}</div>
          ) : (
            <button
              key={item.id}
              onClick={() => item.id && onNavigate(item.id)}
              className={currentView === item.id ? 'on' : ''}
              title={item.label}
            >
              <span className="ic" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.icon}
              </span>
              <span className="lb">{item.label}</span>
            </button>
          )
        ))}
      </nav>

      <div className="side-foot">
        <div className="avatar">
          <img src={`https://i.pravatar.cc/96?img=${user.photo}`} alt="" />
        </div>
        <div className="txt">
          <b>{user.nome}</b>
          <small>{user.papel}</small>
        </div>
        <button 
          onClick={logout} 
          title="Sair" 
          style={{ cursor: 'pointer', background: 'none', border: 0, color: 'var(--side-muted)', display: 'flex', alignItems: 'center' }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
};
