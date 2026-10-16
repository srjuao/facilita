import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { 
  LayoutDashboard, 
  Building2, 
  BookOpen, 
  DollarSign, 
  Menu, X,
  Users, 
  Layers, 
  Radio, 
  FileText, 
  Calendar, 
  Home, 
  Target, 
  MessageSquare, 
  User, 
  LogOut,
  Sliders,
  ShoppingBag
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const main = document.querySelector<HTMLElement>('.app .main');
    const wasInert = main?.inert;
    if (main) main.inert = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    menuRef.current?.querySelector<HTMLButtonElement>('nav button')?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key === 'Tab') {
        const targets = [toggleRef.current, ...Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])].filter((element): element is HTMLButtonElement => !!element);
        const index = targets.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        targets[(index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length]?.focus();
      }
    };
    const desktop = window.matchMedia('(min-width: 761px)');
    const resize = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener('change', resize);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('keydown', close);
      desktop.removeEventListener('change', resize);
      if (main) main.inert = wasInert || false;
      document.body.style.overflow = previousOverflow;
      if (!desktop.matches) toggleRef.current?.focus();
    };
  }, [open]);

  if (!user) return null;

  const role = user.role;

  const NAVS: Record<string, Array<{ sec?: string; id?: string; label?: string; icon?: React.ReactNode }>> = {
    superadmin: [
      { sec: 'Plataforma' },
      { id: 'sa-overview', label: 'Visão geral', icon: <LayoutDashboard size={18} /> },
      { id: 'sa-leads', label: 'Leads e contatos', icon: <MessageSquare size={18} /> },
      { id: 'sa-tenants', label: 'Faculdades', icon: <Building2 size={18} /> },
      { id: 'sa-courses', label: 'Cursos', icon: <BookOpen size={18} /> },
      { id: 'sa-plans', label: 'Planos e assinaturas', icon: <Layers size={18} /> },
      { id: 'sa-fin', label: 'Financeiro', icon: <DollarSign size={18} /> },
      { id: 'sa-account', label: 'Minha conta', icon: <User size={18} /> },
    ],
    coord: [
      { sec: 'Acompanhamento' },
      { id: 'co-dash', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      { id: 'co-alunos', label: 'Alunos', icon: <Users size={18} /> },
      { id: 'co-subs', label: 'Turmas (SUBs)', icon: <Layers size={18} /> },
      { id: 'co-notices', label: 'Avisos', icon: <FileText size={18} /> },
      { id: 'co-chat', label: 'Chat interno', icon: <MessageSquare size={18} /> },
      { id: 'co-live', label: 'Ao vivo', icon: <Radio size={18} /> },
      { id: 'co-provas', label: 'Provas e simulados', icon: <FileText size={18} /> },
      { sec: 'Curso' },
      { id: 'co-ucs', label: 'Períodos e matérias', icon: <Calendar size={18} /> },
      { id: 'co-conteudo', label: 'Conteúdo', icon: <BookOpen size={18} /> },
      { id: 'co-gestao', label: 'Gestão Cursos & Aulas', icon: <Sliders size={18} /> },
      { id: 'co-setup', label: 'Unidade e equipe', icon: <Building2 size={18} /> },
      { id: 'co-team', label: 'Departamentos e acessos', icon: <Users size={18} /> },
      { id: 'co-sales', label: 'Cursos pagos e liberações', icon: <ShoppingBag size={18} /> },
      { id: 'co-staff', label: 'Funcionários', icon: <Users size={18} /> },
    ],
    professor: [
      { sec: 'Meu curso' },
      { id: 'co-notices', label: 'Avisos', icon: <FileText size={18} /> },
      { id: 'co-chat', label: 'Chat interno', icon: <MessageSquare size={18} /> },
      { id: 'co-conteudo', label: 'Materiais do curso', icon: <BookOpen size={18} /> },
      { id: 'co-subs', label: 'Turmas', icon: <Layers size={18} /> },
      { id: 'co-gestao', label: 'Conteúdo e aulas', icon: <BookOpen size={18} /> },
      { id: 'co-alunos', label: 'Alunos', icon: <Users size={18} /> },
      { id: 'co-provas', label: 'Provas e atividades', icon: <FileText size={18} /> },
    ],
    staff: [
      { sec: 'Equipe da instituição' },
      { id: 'co-notices', label: 'Avisos', icon: <FileText size={18} /> },
      { id: 'co-chat', label: 'Chat interno', icon: <MessageSquare size={18} /> },
      { id: 'co-alunos', label: 'Alunos', icon: <Users size={18} /> },
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
      { id: 'al-notices', label: 'Avisos', icon: <FileText size={18} /> },
      { id: 'al-classes', label: 'Minha turma', icon: <Users size={18} /> },
      { id: 'al-chat', label: 'Chat interno', icon: <MessageSquare size={18} /> },
      { id: 'al-store', label: 'Cursos da instituição', icon: <ShoppingBag size={18} /> },
    ]
  };

  const plan = role !== 'superadmin' ? user.tenant?.plan : null;
  const navItems = (NAVS[role] || NAVS.aluno).filter(item => !((item.id === 'al-ia' && plan?.ia === false) || (['al-provas', 'co-provas'].includes(item.id || '') && plan?.provas === false) || (['professor', 'staff'].includes(role) && ((item.id === 'co-gestao' && !user.permissions?.includes('content.manage')) || (item.id === 'co-alunos' && !user.permissions?.includes('students.manage')) || (item.id === 'co-provas' && !user.permissions?.includes('exams.manage'))))));
  const tenantName = user.tenant?.nome || (role === 'superadmin' ? 'Administração da plataforma' : 'Instituição não vinculada');
  const tenantLogo = user.role !== 'superadmin' ? user.tenant?.logoUrl : '';

  return (
    <>
    <div className="mobile-navigation"><span>Facilita Estudos</span><button ref={toggleRef} aria-label={open ? 'Fechar menu' : 'Abrir menu'} aria-expanded={open} aria-controls="platform-navigation" onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button></div>
    {open && <button className="navigation-backdrop" aria-label="Fechar menu" onClick={() => setOpen(false)} />}
    <aside ref={menuRef} id="platform-navigation" className={`side${open ? ' side-open' : ''}`}>
      <div className="wm-wrap">
        <div className="wm-mini">
          <img src={tenantLogo || '/facilita-estudos-mark.svg'} alt={tenantLogo ? tenantName : 'Facilita Estudos'} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/facilita-estudos-mark.svg'; }} />
        </div>
        <div className="wm-full">
          <img src={tenantLogo || '/facilita-estudos-logo.svg'} alt={tenantLogo ? tenantName : 'Facilita Estudos'} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/facilita-estudos-logo.svg'; }} />
        </div>
      </div>
      <div className="tenant">{tenantName}</div>

      <nav className="nav" aria-label="Navegação principal">
        {navItems.map((item, idx) => (
          item.sec ? (
            <div key={idx} className="sec">{item.sec}</div>
          ) : (
            <button
              key={item.id}
              onClick={() => { if (item.id) onNavigate(item.id); setOpen(false); }}
              aria-current={currentView === item.id ? 'page' : undefined}
              className={currentView === item.id ? 'on' : ''}
              title={item.label}
              aria-label={item.label}
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
          <span aria-hidden="true">{user.nome.trim().slice(0, 1).toLocaleUpperCase('pt-BR')}</span>
        </div>
        <div className="txt">
          <b>{user.nome}</b>
          <small>{user.papel}</small>
        </div>
        <button 
          onClick={logout} 
          title="Sair" aria-label="Sair da conta"
          style={{ cursor: 'pointer', background: 'none', border: 0, color: 'var(--side-muted)', display: 'flex', alignItems: 'center' }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
    </>
  );
};
