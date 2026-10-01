import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useCourse } from '../../context/CourseContext';
import api from '../../api/client';
import { TopBar } from '../../components/TopBar';
import { DonutChart } from '../../components/DonutChart';
import { WordMark } from '../../components/WordMark';
import { Play, Calendar, BookOpen, Layers, MessageSquare, FileText, Bell, Plus, Trash2, Pin, CheckCircle2 } from 'lucide-react';

interface StudentHomeProps {
  onNavigate: (view: string) => void;
}

interface Reminder {
  id: number;
  text: string;
  tag: string;
  tagClass: string;
  date: string;
  done: boolean;
  personal?: boolean;
}

export const StudentHome: React.FC<StudentHomeProps> = ({ onNavigate }) => {
  const { user, completedModules } = useAuth();
  const { modules, alerts, markAlertRead } = useCourse();
  const [courseData, setCourseData] = useState<any>(null);

  // Estado dos Lembretes do Aluno
  const [reminders, setReminders] = useState<Reminder[]>([
    {
      id: 1,
      text: 'Prova Integradora — UC1 + UC2',
      tag: 'Importante',
      tagClass: 'crit',
      date: '24/10 às 14:00',
      done: false
    },
    {
      id: 2,
      text: 'Entrega do Relatório de Anamnese',
      tag: 'Prazo',
      tagClass: 'warn',
      date: 'Hoje às 23:59',
      done: false
    },
    {
      id: 3,
      text: 'Revisão diária: 30 Flash Cards pendentes',
      tag: 'Estudo',
      tagClass: 'info',
      date: 'Hoje',
      done: false
    },
    {
      id: 4,
      text: 'Novo PDF de Fisiologia publicado pelo professor',
      tag: 'Aviso',
      tagClass: 'good',
      date: 'Ontem',
      done: true
    }
  ]);

  const [newReminderText, setNewReminderText] = useState('');

  useEffect(() => {
    if (user?.courseId) {
      api.get(`/courses/${user.courseId}`)
        .then(res => setCourseData(res.data))
        .catch(err => console.error(err));
    }
  }, [user]);

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderText.trim()) return;

    const newItem: Reminder = {
      id: Date.now(),
      text: newReminderText,
      tag: 'Pessoal',
      tagClass: 'info',
      date: 'Hoje',
      done: false,
      personal: true
    };

    setReminders([newItem, ...reminders]);
    setNewReminderText('');
  };

  const toggleDone = (id: number) => {
    setReminders(reminders.map(r => r.id === id ? { ...r, done: !r.done } : r));
  };

  const removeReminder = (id: number) => {
    setReminders(reminders.filter(r => r.id !== id));
  };

  const firstName = user?.nome ? user.nome.split(' ')[0] : 'João';
  const courseName = user?.course?.nome || 'Medicina';
  const tenantName = user?.tenant?.nome || 'UNIFAN';

  const defaultModules = [
    {
      id: 'm0',
      nome: 'Semiologia Geral',
      desc: 'Anamnese, sinais vitais e exame físico segmentar',
      aulas: 12,
      color: '#2A78D6',
      img: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?w=600&h=400&fit=crop&q=70'
    },
    {
      id: 'm1',
      nome: 'Fisiologia Humana',
      desc: 'Sistemas cardiovascular, respiratório e renal',
      aulas: 12,
      color: '#eb6834',
      img: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&h=400&fit=crop&q=70'
    },
    {
      id: 'm2',
      nome: 'Bioquímica Médica',
      desc: 'Metabolismo, enzimas e correlações clínicas',
      aulas: 12,
      color: '#1baf7a',
      img: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=600&h=400&fit=crop&q=70'
    },
    {
      id: 'm3',
      nome: 'Atenção Primária',
      desc: 'Estratégia Saúde da Família e prevenção',
      aulas: 15,
      color: '#eda100',
      img: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&h=400&fit=crop&q=70'
    },
  ];

  const finalModules = courseData?.modules?.length ? courseData.modules : modules;

  return (
    <div style={{ paddingBottom: '40px' }}>
      <TopBar courseName={courseName} currentPage="Início" />

      <div style={{ padding: '0 28px' }}>
        {/* Page Head */}
        <div className="page-head" style={{ marginBottom: '20px' }}>
          <div>
            <h1>Olá, {firstName}!</h1>
            <p>
              Bem-vindo(a) ao seu espaço de evolução. Você está na semana 12 — a prova integradora é em 24/10.
            </p>
          </div>
        </div>

        {/* ALERTA DE NOVO CONTEÚDO DISPONÍVEL (QUANDO ADM ADICIONA AULA) */}
        {alerts.some(a => a.unread) && (
          <div 
            style={{ 
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              border: '2px solid var(--accent)',
              borderRadius: '14px',
              padding: '16px 20px',
              marginBottom: '24px',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 8px 24px rgba(42, 120, 214, 0.25)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Bell size={22} />
              </div>
              <div>
                <span className="pill info" style={{ fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Alerta Acadêmico · Novo Conteúdo Postado!
                </span>
                <h3 style={{ fontSize: '16px', margin: '2px 0 4px', color: '#fff' }}>
                  {alerts.find(a => a.unread)?.title}
                </h3>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', margin: 0 }}>
                  {alerts.find(a => a.unread)?.message}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button 
                className="btn primary" 
                onClick={() => {
                  markAlertRead(alerts.find(a => a.unread)?.id || '');
                  onNavigate('al-materias');
                }}
                style={{ whiteSpace: 'nowrap' }}
              >
                Ver no Curso →
              </button>
              <button 
                className="btn ghost sm"
                onClick={() => markAlertRead(alerts.find(a => a.unread)?.id || '')}
                style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                Dispensar
              </button>
            </div>
          </div>
        )}

        {/* Hero Banner */}
        <div 
          className="hero" 
          style={{ 
            marginBottom: '24px',
            backgroundImage: `linear-gradient(90deg, #2A78D6 0%, #2A78D6 42%, rgba(42,120,214,0.85) 65%, rgba(42,120,214,0.3) 100%), url('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1200&h=600&fit=crop&q=80')` 
          }}
        >
          <div className="eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>
            <WordMark courseName={courseName} /> · {tenantName}
          </div>
          <h1 style={{ color: '#fff', fontSize: '32px', margin: '10px 0', fontWeight: 600 }}>
            Conhecimento para um futuro maior.
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.92)', fontSize: '14px', maxWidth: '520px', lineHeight: 1.5 }}>
            "Estudar {courseName.toLowerCase()} é construir possibilidades de um mundo melhor." Continue de onde parou: Histologia · Tecidos conjuntivos (faltam 22 min).
          </p>

          <div className="cta" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button className="btn" onClick={() => onNavigate('al-aula')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Play size={14} fill="currentColor" /> Continuar aula
            </button>
            <button className="btn" onClick={() => onNavigate('al-flash')}>
              Revisar 30 cards de hoje
            </button>
            <button className="btn" onClick={() => onNavigate('al-provas')}>
              Simulado rápido
            </button>
          </div>

          <span className="quote" style={{ fontStyle: 'italic', opacity: 0.9 }}>
            Grandes profissionais começam aqui.
          </span>
        </div>

        {/* Acesso Rápido */}
        <div style={{ marginBottom: '28px' }}>
          <div className="eyebrow" style={{ marginBottom: '12px' }}>Acesso rápido</div>
          <div className="quick">
            <button onClick={() => onNavigate('al-periodos')}>
              <span className="ic"><Calendar size={18} /></span>
              <span>
                <b>Períodos</b>
                <small>Veja seu conteúdo</small>
              </span>
            </button>

            <button onClick={() => onNavigate('al-materias')}>
              <span className="ic"><BookOpen size={18} /></span>
              <span>
                <b>Matérias</b>
                <small>Explore as disciplinas</small>
              </span>
            </button>

            <button onClick={() => onNavigate('al-flash')}>
              <span className="ic"><Layers size={18} /></span>
              <span>
                <b>Flash Cards</b>
                <small>Revise com eficiência</small>
              </span>
            </button>

            <button onClick={() => onNavigate('al-ia')}>
              <span className="ic"><MessageSquare size={18} /></span>
              <span>
                <b>IA Tira-Dúvidas</b>
                <small>Tire suas dúvidas</small>
              </span>
            </button>

            <button onClick={() => onNavigate('al-provas')}>
              <span className="ic"><FileText size={18} /></span>
              <span>
                <b>Provas</b>
                <small>Treine para evoluir</small>
              </span>
            </button>
          </div>
        </div>

        {/* Grid de Conteúdo */}
        <div className="grid g32" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          {/* Coluna Esquerda: Matérias */}
          <div>
            <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2>Matérias principais</h2>
              <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('al-materias'); }} style={{ color: 'var(--accent-ink)', fontWeight: 600, fontSize: '13px' }}>
                Ver todas →
              </a>
            </div>

            <div className="grid g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
              {finalModules.slice(0, 4).map((m: any, i: number) => {
                const isCompleted = completedModules.includes(m.nome);
                const count = m.lessons ? m.lessons.length : (m.aulas ? m.aulas : 12);
                return (
                  <div 
                    key={m.id || i} 
                    className="card mcard" 
                    onClick={() => onNavigate('al-materias')}
                    style={{ border: isCompleted ? '1px solid var(--good)' : '1px solid var(--line)' }}
                  >
                    <div 
                      className="art" 
                      style={{ 
                        background: `linear-gradient(180deg, rgba(18,33,58,0) 40%, rgba(18,33,58,.55)), url(${m.img}) center/cover` 
                      }}
                    >
                      <span className={`pill ${isCompleted ? 'good' : ''}`}>
                        {isCompleted ? 'Concluída ✓' : `${count} aulas`}
                      </span>
                    </div>
                    <div className="bd">
                      <b>{m.nome}</b>
                      <small>{m.desc}</small>
                      <div className="bar" style={{ marginTop: '6px' }}>
                        <i style={{ width: isCompleted ? '100%' : `${60 + i * 8}%`, background: isCompleted ? 'var(--good)' : m.color || 'var(--accent)' }}></i>
                      </div>
                      <small style={{ color: isCompleted ? 'var(--good)' : 'var(--accent-ink)', fontWeight: 700, marginTop: '4px' }}>
                        {isCompleted ? 'Revisar →' : 'Acessar →'}
                      </small>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coluna Direita: Progresso + Quadro de Lembretes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Card de Progresso */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px' }}>
              <DonutChart pct={65} size={92} color="var(--accent)" label="concluído" />
              <div>
                <b style={{ display: 'block', fontSize: '16px', color: 'var(--ink)' }}>Seu progresso</b>
                <small className="muted" style={{ fontSize: '13px' }}>33 de 51 aulas · 41h12 de estudo</small>
                <div style={{ marginTop: '10px' }}>
                  <span className="pill good">Acima da turma</span>
                </div>
              </div>
            </div>

            {/* Quadro de Lembretes */}
            <div className="card" style={{ padding: '20px' }}>
              <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                  <Bell size={18} style={{ color: 'var(--accent)' }} /> Lembretes e Avisos
                </h3>
                <span className="pill neutral" style={{ fontSize: '11px' }}>
                  {reminders.filter(r => !r.done).length} pendentes
                </span>
              </div>

              {/* Formulário para adicionar lembrete pessoal */}
              <form onSubmit={handleAddReminder} style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Novo lembrete pessoal..."
                  value={newReminderText}
                  onChange={(e) => setNewReminderText(e.target.value)}
                  style={{ fontSize: '12px', padding: '7px 10px', flex: 1 }}
                />
                <button type="submit" className="btn primary sm" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Plus size={14} /> Add
                </button>
              </form>

              {/* Lista de Lembretes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {reminders.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: r.done ? 'var(--paper-2)' : 'var(--paper)',
                      border: '1px solid var(--line-2)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      opacity: r.done ? 0.65 : 1,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <button
                      onClick={() => toggleDone(r.id)}
                      style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', marginTop: '2px', color: r.done ? 'var(--good)' : 'var(--muted)' }}
                    >
                      <CheckCircle2 size={16} />
                    </button>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: r.done ? 400 : 600, textDecoration: r.done ? 'line-through' : 'none', color: 'var(--ink)' }}>
                        {r.text}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <span className={`pill ${r.tagClass}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                          {r.tag}
                        </span>
                        <small className="muted" style={{ fontSize: '11px' }}>{r.date}</small>
                      </div>
                    </div>

                    {r.personal && (
                      <button
                        onClick={() => removeReminder(r.id)}
                        style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--muted)' }}
                        title="Remover"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
