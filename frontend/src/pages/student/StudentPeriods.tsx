import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useCourse } from '../../context/CourseContext';
import { TopBar } from '../../components/TopBar';
import { CertificateModal } from '../../components/CertificateModal';
import { 
  Calendar, 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  Award, 
  Play, 
  Layers, 
  FileText, 
  ChevronRight, 
  Lock, 
  GraduationCap, 
  Sparkles,
  ArrowUpRight,
  UserCheck
} from 'lucide-react';

interface StudentPeriodsProps {
  onNavigateLesson?: (lessonId: string) => void;
  onNavigateView?: (view: string) => void;
}

export const StudentPeriods: React.FC<StudentPeriodsProps> = ({ onNavigateLesson, onNavigateView }) => {
  const { user, completedModules } = useAuth();
  const { modules } = useCourse();
  const [activePeriod, setActivePeriod] = useState<number>(1);
  const [selectedCertModule, setSelectedCertModule] = useState<string | null>(null);

  const courseName = user?.course?.nome || 'Medicina';
  const tenantName = user?.tenant?.nome || 'UNIFAN — Centro Universitário Nobre';

  // Matriz Curricular por Período
  const periodsData = [
    {
      periodo: 1,
      titulo: '1º Período · Ciclo Básico & Introdução Clínica',
      ano: '2026.1',
      status: 'EM_ANDAMENTO',
      ucs: [
        {
          id: 'uc1',
          code: 'UC-MED-01',
          nome: 'UC1 · Anamnese, Comunicação e Exame Físico',
          desc: 'Técnicas de semiologia médica, relação médico-paciente, ausculta e inspeção geral.',
          prof: 'Prof. Dr. Sérgio Amaral',
          profPhoto: 'https://i.pravatar.cc/96?img=33',
          aulas: 17,
          horas: '60h',
          cor: '#2A78D6',
          moduleMatch: 'Semiologia Geral',
          materias: ['Semiologia Geral', 'Anamnese Clínica', 'Exame Físico Segmentar']
        },
        {
          id: 'uc2',
          code: 'UC-MED-02',
          nome: 'UC2 · Fundamentos Biológicos e Fisiologia Humana',
          desc: 'Fisiologia cardiovascular, respiratória, renal e potenciais de ação celulares.',
          prof: 'Profa. Dra. Helena Castro',
          profPhoto: 'https://i.pravatar.cc/96?img=47',
          aulas: 17,
          horas: '60h',
          cor: '#eb6834',
          moduleMatch: 'Fisiologia Humana',
          materias: ['Fisiologia Humana', 'Hemodinâmica', 'Sistema Respiratório']
        },
        {
          id: 'uc3',
          code: 'UC-MED-03',
          nome: 'UC3 · Bioquímica Médica e Metabolismo Celular',
          desc: 'Enzimas, metabolismo de glicídios, lipídios e correlações clínicas patológicas.',
          prof: 'Prof. Dr. Marcos Viana',
          profPhoto: 'https://i.pravatar.cc/96?img=12',
          aulas: 12,
          horas: '45h',
          cor: '#1baf7a',
          moduleMatch: 'Bioquímica Médica',
          materias: ['Bioquímica Médica', 'Ciclo de Krebs', 'Integracao Metabólica']
        },
        {
          id: 'uc4',
          code: 'UC-MED-04',
          nome: 'UC4 · Atenção Primária e Saúde da Família I',
          desc: 'Princípios do SUS, Estratégia Saúde da Família, Genograma e prevenção.',
          prof: 'Profa. Dra. Camila Dantas',
          profPhoto: 'https://i.pravatar.cc/96?img=25',
          aulas: 15,
          horas: '45h',
          cor: '#eda100',
          moduleMatch: 'Atenção Primária',
          materias: ['Princípios do SUS', 'ESF', 'Abordagem Familiar']
        }
      ]
    },
    {
      periodo: 2,
      titulo: '2º Período · Imunologia & Patologia Geral',
      ano: '2026.2',
      status: 'BLOQUEADO',
      ucs: [
        { id: 'uc5', code: 'UC-MED-05', nome: 'UC5 · Imunologia Clínica e Inflamação', desc: 'Respostas imunes inata e adaptativa, hipersensibilidades e autoimunidade.', prof: 'Prof. Dr. Renato Costa', profPhoto: 'https://i.pravatar.cc/96?img=59', aulas: 16, horas: '60h', cor: '#8b5cf6', moduleMatch: '', materias: ['Imunologia Inata', 'Imunopatologia'] },
        { id: 'uc6', code: 'UC-MED-06', nome: 'UC6 · Patologia Geral e Alterações Celulares', desc: 'Lesão celular, necrose, apoptose e processos neoplásicos.', prof: 'Profa. Dra. Vanessa Lins', profPhoto: 'https://i.pravatar.cc/96?img=18', aulas: 16, horas: '60h', cor: '#ec4899', moduleMatch: '', materias: ['Patologia Geral', 'Oncogenese'] }
      ]
    },
    {
      periodo: 3,
      titulo: '3º Período · Farmacologia & Infectologia',
      ano: '2027.1',
      status: 'BLOQUEADO',
      ucs: [
        { id: 'uc7', code: 'UC-MED-07', nome: 'UC7 · Farmacologia Básica e Aplicada', desc: 'Farmacocinética, farmacodinâmica e receptores de drogas.', prof: 'Prof. Dr. André Bastos', profPhoto: 'https://i.pravatar.cc/96?img=60', aulas: 18, horas: '60h', cor: '#06b6d4', moduleMatch: '', materias: ['Farmacocinética', 'Antibioticoterapia'] }
      ]
    }
  ];

  const currentPeriodData = periodsData.find(p => p.periodo === activePeriod) || periodsData[0];

  return (
    <div style={{ paddingBottom: '50px' }}>
      <TopBar courseName={courseName} currentPage="Períodos Acadêmicos" />

      <div style={{ padding: '0 28px' }}>
        {/* Cabeçalho da Página */}
        <div className="page-head" style={{ marginBottom: '24px' }}>
          <div>
            <div className="eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--accent-ink)' }}>
              Matriz Curricular · {tenantName}
            </div>
            <h1 style={{ fontSize: '28px', margin: '4px 0 6px' }}>Períodos Acadêmicos</h1>
            <p style={{ color: 'var(--ink-2)', fontSize: '14px', maxWidth: '680px', margin: 0 }}>
              Estrutura pedagógica organizada por semestres e Unidades Curriculares (UCs). Acompanhe a sua evolução na graduação de {courseName}.
            </p>
          </div>
        </div>

        {/* HERO CARD DE PROGRESSO DA GRADUAÇÃO */}
        <div 
          className="card"
          style={{ 
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #1e3a8a 100%)', 
            borderRadius: '16px', 
            padding: '24px 28px', 
            marginBottom: '28px',
            color: '#fff',
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.25)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'center', position: 'relative', zIndex: 1 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="pill info" style={{ background: 'rgba(42, 120, 214, 0.3)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.3)', fontSize: '11px' }}>
                  <GraduationCap size={13} style={{ display: 'inline', marginRight: '4px' }} /> Período Vigente: 1º Semestre
                </span>
                <span className="pill good" style={{ fontSize: '11px' }}>Matrícula Ativa</span>
              </div>
              
              <h2 style={{ color: '#fff', fontSize: '22px', margin: '0 0 8px', fontWeight: 700 }}>
                Evolução na Matriz Curricular de {courseName}
              </h2>
              
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 16px', maxWidth: '520px' }}>
                Você concluiu <b>{completedModules.length} de 4 UCs</b> do 1º Período. Cumpra todas as avaliações para avançar na grade acadêmica.
              </p>

              {/* Barra de Progresso do Curso */}
              <div style={{ maxWidth: '540px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px', color: '#cbd5e1' }}>
                  <span>Progresso Geral do Curso (1º ao 12º Período)</span>
                  <b style={{ color: '#60a5fa' }}>15% Concluído</b>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.15)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ width: '15%', background: 'linear-gradient(90deg, #2A78D6 0%, #38bdf8 100%)', height: '100%', borderRadius: '10px' }} />
                </div>
              </div>
            </div>

            {/* MINI STATUS DA GRADUAÇÃO */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '12px', backdropFilter: 'blur(4px)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Carga Horária</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: '2px 0' }}>210h / 7.200h</div>
                <small style={{ fontSize: '11px', color: '#38bdf8' }}>Horas Cumpridas</small>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Média de Rendimento</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#f59e0b', margin: '2px 0' }}>8.8 / 10.0</div>
                <small style={{ fontSize: '11px', color: '#f59e0b' }}>CR Acadêmico</small>
              </div>
            </div>
          </div>
        </div>

        {/* SELETOR DE PERÍODOS (1º AO 8º PERÍODO) */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'var(--muted)', marginBottom: '10px' }}>
            Navegar pelos Semestres da Matriz
          </div>

          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
            {periodsData.map((p) => {
              const isActive = activePeriod === p.periodo;
              const isBlocked = p.status === 'BLOQUEADO';

              return (
                <button
                  key={p.periodo}
                  onClick={() => setActivePeriod(p.periodo)}
                  style={{
                    padding: '12px 18px',
                    borderRadius: '10px',
                    border: isActive ? '2px solid var(--accent)' : '1px solid var(--line)',
                    background: isActive ? 'var(--accent-soft)' : 'var(--paper)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.15s ease',
                    minWidth: '160px',
                    textAlign: 'left'
                  }}
                >
                  <span 
                    style={{ 
                      width: '28px', 
                      height: '28px', 
                      borderRadius: '8px', 
                      background: isActive ? 'var(--accent)' : isBlocked ? 'var(--paper-2)' : 'var(--good-soft)',
                      color: isActive ? '#fff' : isBlocked ? 'var(--muted)' : 'var(--good)',
                      display: 'grid', 
                      placeItems: 'center', 
                      fontWeight: 700,
                      fontSize: '13px'
                    }}
                  >
                    {isBlocked ? <Lock size={14} /> : `${p.periodo}º`}
                  </span>

                  <div>
                    <b style={{ fontSize: '13px', display: 'block', color: isActive ? 'var(--accent-ink)' : 'var(--ink)' }}>
                      {p.periodo}º Período
                    </b>
                    <small style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {isBlocked ? 'Semestre Futuro' : p.status === 'EM_ANDAMENTO' ? 'Em andamento' : 'Concluído'}
                    </small>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* TÍTULO DO PERÍODO SELECIONADO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={20} style={{ color: 'var(--accent)' }} /> {currentPeriodData.titulo}
          </h2>
          <span className="pill info" style={{ fontSize: '12px' }}>
            {currentPeriodData.ucs.length} Unidades Curriculares (UCs)
          </span>
        </div>

        {/* GRID DE UNIDADES CURRICULARES (UCs) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {currentPeriodData.ucs.map((uc) => {
            const isCompleted = completedModules.includes(uc.moduleMatch);
            const liveModule = modules.find(m => m.nome.toLowerCase() === uc.moduleMatch.toLowerCase() || m.id === uc.id);
            const totalAulas = liveModule ? liveModule.lessons.length : uc.aulas;

            return (
              <div 
                key={uc.id} 
                className="card"
                style={{ 
                  borderRadius: '14px', 
                  border: isCompleted ? '2px solid var(--good)' : '1px solid var(--line)',
                  padding: '24px',
                  transition: 'all 0.2s ease',
                  background: 'var(--paper)'
                }}
              >
                {/* CABEÇALHO DA UC */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div 
                      style={{ 
                        width: '44px', 
                        height: '44px', 
                        borderRadius: '10px', 
                        background: `${uc.cor}15`, 
                        color: uc.cor, 
                        display: 'grid', 
                        placeItems: 'center',
                        fontWeight: 700,
                        fontSize: '18px',
                        flexShrink: 0
                      }}
                    >
                      <BookOpen size={22} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className="pill neutral" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                          {uc.code}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} /> {uc.horas} Carga Horária
                        </span>
                      </div>

                      <h3 style={{ fontSize: '18px', margin: '0 0 6px', color: 'var(--ink)' }}>
                        {uc.nome}
                      </h3>

                      <p style={{ fontSize: '13px', color: 'var(--ink-2)', margin: 0, maxWidth: '640px', lineHeight: 1.5 }}>
                        {uc.desc}
                      </p>
                    </div>
                  </div>

                  {/* BADGE DE STATUS E CERTIFICADO */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {isCompleted && (
                      <button 
                        className="btn sm outline"
                        onClick={() => setSelectedCertModule(uc.moduleMatch)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--accent-ink)' }}
                      >
                        <Award size={14} /> Ver Certificado
                      </button>
                    )}

                    <span 
                      className={`pill ${isCompleted ? 'good' : 'info'}`} 
                      style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600 }}
                    >
                      {isCompleted ? 'UC Concluída ✓' : `${totalAulas} Aulas Publicadas`}
                    </span>
                  </div>
                </div>

                {/* PROFESSOR E DISCIPLINAS INTEGRADAS */}
                <div 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '12px 16px', 
                    borderRadius: '10px', 
                    background: 'var(--paper-2)', 
                    marginBottom: '16px',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img 
                      src={uc.profPhoto} 
                      alt="" 
                      style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--line)' }} 
                    />
                    <div style={{ fontSize: '12px' }}>
                      <span className="muted" style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Docente Responsável</span>
                      <b>{uc.prof}</b>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Tópicos da UC:</span>
                    {uc.materias.map((mat, i) => (
                      <span key={i} className="chip sm" style={{ fontSize: '11px', padding: '3px 8px' }}>
                        {mat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* BOTÕES DE AÇÃO DIRETA NA UC */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--line-2)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <UserCheck size={14} style={{ color: 'var(--good)' }} /> Frequência Mínima Requerida: 75%
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      className="btn outline sm"
                      onClick={() => onNavigateView && onNavigateView('al-flash')}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Layers size={14} /> Flashcards
                    </button>

                    <button 
                      className="btn primary sm"
                      onClick={() => onNavigateView && onNavigateView('al-materias')}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Play size={13} fill="currentColor" /> Acessar Conteúdo & Aulas
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal do Certificado Digital */}
      {selectedCertModule && (
        <CertificateModal
          studentName={user?.nome || 'João Silva'}
          courseName={user?.course?.nome || 'Medicina'}
          moduleName={selectedCertModule}
          tenantName={tenantName}
          onClose={() => setSelectedCertModule(null)}
        />
      )}
    </div>
  );
};
