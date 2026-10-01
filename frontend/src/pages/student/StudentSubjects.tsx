import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useCourse } from '../../context/CourseContext';
import { TopBar } from '../../components/TopBar';
import { CertificateModal } from '../../components/CertificateModal';
import { Play, CheckCircle2, Award, Bell } from 'lucide-react';

interface StudentSubjectsProps {
  onOpenLesson?: (lessonId: string) => void;
}

export const StudentSubjects: React.FC<StudentSubjectsProps> = ({ onOpenLesson }) => {
  const { user, completedModules } = useAuth();
  const { modules, alerts, markAlertRead, isLessonCompleted } = useCourse();
  const [selectedCertModule, setSelectedCertModule] = useState<string | null>(null);

  return (
    <div>
      <TopBar currentPage="Matérias" />
      <div style={{ padding: '0 28px 40px' }}>
        <div className="page-head" style={{ marginBottom: '20px' }}>
          <div>
            <h1>Matérias</h1>
            <p>Semiologia Geral, Fisiologia Humana, Bioquímica Médica, Atenção Primária — cada uma com aulas, materiais, flash cards e questões.</p>
          </div>
        </div>

        {/* Banner de Novo Conteudo se houver Alerta */}
        {alerts.some(a => a.unread) && (
          <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: '12px', padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Bell size={24} style={{ color: 'var(--accent-ink)' }} />
              <div>
                <b style={{ color: 'var(--accent-ink)', fontSize: '14px', display: 'block' }}>
                  {alerts.find(a => a.unread)?.title}
                </b>
                <span style={{ fontSize: '13px', color: 'var(--ink)' }}>
                  {alerts.find(a => a.unread)?.message}
                </span>
              </div>
            </div>
            <button className="btn sm primary" onClick={() => markAlertRead(alerts.find(a => a.unread)?.id || '')}>
              Entendi
            </button>
          </div>
        )}

        <div className="grid g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {modules.map((m) => {
            const isCompleted = completedModules.includes(m.nome);
            return (
              <div key={m.id} className="card" style={{ border: isCompleted ? '1px solid var(--good)' : '1px solid var(--line)' }}>
                <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i style={{ width: '12px', height: '12px', borderRadius: '3px', background: m.color, display: 'inline-block' }}></i>
                    {m.nome}
                  </h2>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {isCompleted && (
                      <button 
                        className="btn sm outline"
                        onClick={() => setSelectedCertModule(m.nome)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--accent-ink)' }}
                      >
                        <Award size={13} /> Ver Certificado
                      </button>
                    )}
                    <span className={`pill ${isCompleted ? 'good' : 'neutral'}`}>
                      {isCompleted ? 'Matéria Concluída ✓' : `${m.lessons.length} aulas`}
                    </span>
                  </div>
                </div>
              <p style={{ fontSize: '13px', color: 'var(--ink-2)', marginBottom: '14px' }}>{m.desc}</p>

              <div className="list">
                {m.lessons.map((aula, idx) => {
                  const watched = isLessonCompleted(aula.id);
                  return (
                    <div key={aula.id || idx} className="row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>{aula.titulo}</span>
                            {watched && (
                              <span className="pill good" style={{ fontSize: '10px', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={11} /> Já Assistida
                              </span>
                            )}
                          </div>
                          <small className="muted" style={{ fontSize: '11px' }}>{aula.prof} · {aula.duracao}</small>
                        </div>
                      </div>

                      <button 
                        className={`btn sm ${watched ? 'outline' : 'primary'}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => onOpenLesson && onOpenLesson(aula.id)}
                      >
                        <Play size={12} fill="currentColor" /> {watched ? 'Assistir Novamente' : 'Assistir'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        </div>
        {/* Modal do Certificado Digital */}
        {selectedCertModule && (
          <CertificateModal
            studentName={user?.nome || 'João Silva'}
            courseName={user?.course?.nome || 'Medicina'}
            moduleName={selectedCertModule}
            tenantName={user?.tenant?.nome || 'UNIFAN — Centro Universitário Nobre'}
            onClose={() => setSelectedCertModule(null)}
          />
        )}
      </div>
    </div>
  );
};
