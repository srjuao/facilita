import React, { useState } from 'react';
import { TopBar } from '../../components/TopBar';
import { FileText, Plus, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

interface ModuleExamConfig {
  moduleName: string;
  examTitle: string;
  numQuestions: number;
  minScore: number;
  configured: boolean;
}

export const CoordContent: React.FC = () => {
  const [modulesExams, setModulesExams] = useState<ModuleExamConfig[]>([
    {
      moduleName: 'Semiologia Geral',
      examTitle: 'Prova Final — Avaliação de Anamnese e Exame Físico',
      numQuestions: 20,
      minScore: 7.0,
      configured: true
    },
    {
      moduleName: 'Fisiologia Humana',
      examTitle: 'Prova Final — Fisiologia Renal, Cardíaca e Respiratória',
      numQuestions: 25,
      minScore: 7.0,
      configured: true
    },
    {
      moduleName: 'Bioquímica Médica',
      examTitle: 'Prova Final — Integração Metabólica e Enzimas',
      numQuestions: 20,
      minScore: 7.0,
      configured: true
    },
    {
      moduleName: 'Atenção Primária',
      examTitle: 'Prova Final — ESF e Prevenção Quaternária',
      numQuestions: 15,
      minScore: 7.0,
      configured: true
    },
  ]);

  const [selectedModule, setSelectedModule] = useState<ModuleExamConfig | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newQuestions, setNewQuestions] = useState(20);
  const [newMinScore, setNewMinScore] = useState(7.0);

  const handleOpenConfigModal = (m: ModuleExamConfig) => {
    setSelectedModule(m);
    setNewTitle(m.examTitle || `Prova Final — Conclusão de ${m.moduleName}`);
    setNewQuestions(m.numQuestions || 20);
    setNewMinScore(m.minScore || 7.0);
  };

  const handleSaveExamConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModule) return;

    setModulesExams(modulesExams.map(m => {
      if (m.moduleName === selectedModule.moduleName) {
        return {
          ...m,
          examTitle: newTitle,
          numQuestions: Number(newQuestions),
          minScore: Number(newMinScore),
          configured: true
        };
      }
      return m;
    }));

    setSelectedModule(null);
  };

  return (
    <div>
      <TopBar currentPage="Conteúdo" />
      <div style={{ padding: '0 28px 40px' }}>
        <div className="page-head" style={{ marginBottom: '20px' }}>
          <div>
            <div className="eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>Gestão de Matérias & Provas</div>
            <h1 style={{ fontSize: '26px' }}>Gestão de Conteúdo e Provas de Matéria</h1>
            <p>Por padrão, ao final de cada matéria o administrador da universidade define a prova obrigatória de conclusão.</p>
          </div>
        </div>

        <div className="grid g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {modulesExams.map((m, i) => (
            <div key={i} className="card" style={{ border: m.configured ? '1px solid var(--line)' : '1px dashed var(--warn)' }}>
              <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '18px' }}>{m.moduleName}</h3>
                <span className={`pill ${m.configured ? 'good' : 'warn'}`}>
                  {m.configured ? 'Prova Ativa ✓' : 'Pendente de Prova'}
                </span>
              </div>
              <p className="muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
                12 aulas cadastradas · videoaulas, materiais em PDF e flash cards.
              </p>

              {/* Quadro da Prova de Final de Matéria */}
              <div style={{ padding: '14px', background: 'var(--paper-2)', borderRadius: '8px', border: '1px solid var(--line-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <FileText size={16} style={{ color: 'var(--accent)' }} />
                  <b style={{ fontSize: '13px', color: 'var(--ink)' }}>Prova Obrigatória ao Final da Matéria:</b>
                </div>

                {m.configured ? (
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-2)' }}>{m.examTitle}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', display: 'flex', gap: '12px' }}>
                      <span>{m.numQuestions} questões</span>
                      <span>Nota mínima para aprovação: <b>{m.minScore.toFixed(1)}</b></span>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} /> Nenhuma prova cadastrada para o final desta matéria.
                  </div>
                )}

                <div style={{ marginTop: '12px', textAlign: 'right' }}>
                  <button 
                    className="btn sm outline"
                    onClick={() => handleOpenConfigModal(m)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={14} /> {m.configured ? 'Editar Prova Final' : 'Configurar Prova Final'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modal de Configuração da Prova */}
        {selectedModule && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
            <form className="card" onSubmit={handleSaveExamConfig} style={{ width: '520px', maxWidth: '90vw' }}>
              <h3>Configurar Prova Final — {selectedModule.moduleName}</h3>
              <p className="muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
                Defina os parâmetros da avaliação obrigatória que os alunos responderão após concluir todas as aulas da matéria.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="field">
                  <label>Título da Prova Final</label>
                  <input 
                    type="text" 
                    value={newTitle} 
                    onChange={(e) => setNewTitle(e.target.value)} 
                    required 
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="field">
                    <label>Número de Questões</label>
                    <input 
                      type="number" 
                      min="5" 
                      max="50" 
                      value={newQuestions} 
                      onChange={(e) => setNewQuestions(Number(e.target.value))} 
                      required 
                    />
                  </div>

                  <div className="field">
                    <label>Nota Mínima de Aprovação</label>
                    <input 
                      type="number" 
                      step="0.5" 
                      min="5" 
                      max="10" 
                      value={newMinScore} 
                      onChange={(e) => setNewMinScore(Number(e.target.value))} 
                      required 
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn" onClick={() => setSelectedModule(null)}>Cancelar</button>
                <button type="submit" className="btn primary">Salvar e Ativar Prova</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
