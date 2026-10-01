import React, { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useCourse } from '../../context/CourseContext';
import { TopBar } from '../../components/TopBar';
import { BookOpen, Video, FileText, Plus, Edit, Trash2, CheckCircle2, ShieldAlert, Award, Sliders, Upload, FileVideo, Check, Bell } from 'lucide-react';
import axios from 'axios';

export const CoordCourseManager: React.FC = () => {
  const { user } = useAuth();
  const { modules, addLesson, deleteLesson, retakeRequests, approveRetake } = useCourse();
  const [activeTab, setActiveTab] = useState<'courses' | 'lessons' | 'exams'>('lessons');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('m1'); // Fisiologia Humana por padrao ou m0

  // Modais de Criação
  const [showAddLessonModal, setShowAddLessonModal] = useState<boolean>(false);
  const [showAddExamModal, setShowAddExamModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form de Nova Aula
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonProf, setNewLessonProf] = useState('Profa. Dra. Helena Castro');
  const [newLessonDuration, setNewLessonDuration] = useState('45 min');
  const [newLessonVideoUrl, setNewLessonVideoUrl] = useState('');
  const [newLessonDesc, setNewLessonDesc] = useState('');

  // Upload State
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [selectedFileName, setSelectedFileName] = useState<string>('');

  // Form de Nova Questão de Prova
  const [newQuestionEnunciado, setNewQuestionEnunciado] = useState('');
  const [newAltA, setNewAltA] = useState('');
  const [newAltB, setNewAltB] = useState('');
  const [newAltC, setNewAltC] = useState('');
  const [newAltD, setNewAltD] = useState('');
  const [correctAlt, setCorrectAlt] = useState(0);

  const tenantName = user?.tenant?.nome || 'UNIFAN';
  const courseName = user?.course?.nome || 'Medicina';

  const currentModule = modules.find(m => m.id === selectedModuleId || m.nome.toLowerCase() === selectedModuleId.toLowerCase()) || modules[0];

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('video', file);

    try {
      const response = await axios.post('http://localhost:3001/api/upload/video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        }
      });

      if (response.data?.videoUrl) {
        setNewLessonVideoUrl(response.data.videoUrl);
      }
    } catch (err) {
      alert('Erro ao fazer upload do vídeo. Verifique a conexão com o servidor.');
    } finally {
      setUploading(false);
    }
  };

  const handleAddLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLessonTitle.trim()) return;

    const newLessonData = {
      titulo: newLessonTitle,
      prof: newLessonProf,
      duracao: newLessonDuration,
      videoUrl: newLessonVideoUrl || 'http://localhost:3001/uploads/videos/aula1_semiologia.mp4',
      desc: newLessonDesc || 'Aula cadastrada pelo administrador da faculdade.'
    };

    addLesson(selectedModuleId, newLessonData);

    setShowAddLessonModal(false);
    setNewLessonTitle('');
    setNewLessonVideoUrl('');
    setSelectedFileName('');
    setNewLessonDesc('');

    setToastMessage(`✅ Aula "${newLessonTitle}" adicionada em ${currentModule.nome}! Alerta enviado aos alunos.`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleDeleteLesson = (lessonId: string) => {
    deleteLesson(selectedModuleId, lessonId);
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <TopBar courseName={courseName} currentPage="Gestão de Cursos e Aulas" />

      <div style={{ padding: '0 28px' }}>
        {/* Page Head */}
        <div className="page-head" style={{ marginBottom: '20px' }}>
          <div>
            <div className="eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Painel do Administrador · {tenantName}
            </div>
            <h1 style={{ fontSize: '26px' }}>Gestão de Cursos, Aulas e Provas</h1>
            <p>Configuração exclusiva da faculdade {tenantName}. Cadastre videoaulas, organize matérias e crie provas acadêmicas.</p>
          </div>
        </div>

        {/* Abas Superiores de Configuração */}
        <div className="filters" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button 
            className={`chip ${activeTab === 'lessons' ? 'on' : ''}`}
            onClick={() => setActiveTab('lessons')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Video size={16} /> Gestão de Videoaulas
          </button>
          <button 
            className={`chip ${activeTab === 'exams' ? 'on' : ''}`}
            onClick={() => setActiveTab('exams')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText size={16} /> Criar Prova / Questões
          </button>
          <button 
            className={`chip ${activeTab === 'courses' ? 'on' : ''}`}
            onClick={() => setActiveTab('courses')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <BookOpen size={16} /> Cursos & Matérias ({tenantName})
          </button>
        </div>

        {/* ABA 1: GESTÃO DE VIDEOAULAS */}
        {activeTab === 'lessons' && (
          <div>
            {/* Seletor de Matéria + Botão de Nova Aula */}
            <div className="card" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <b style={{ fontSize: '14px' }}>Selecionar Matéria:</b>
                <select 
                  value={selectedModuleId} 
                  onChange={(e) => setSelectedModuleId(e.target.value)}
                  style={{ width: '240px', padding: '8px 12px' }}
                >
                  {modules.map(m => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </div>

              <button 
                className="btn primary"
                onClick={() => setShowAddLessonModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> + Cadastrar Nova Videoaula
              </button>
            </div>

            {/* Lista de Aulas do Módulo Selecionado */}
            <div className="card">
              <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3>Grade de Videoaulas — {currentModule.nome} ({currentModule.lessons.length} Aulas)</h3>
                <span className="pill info">Sequencial Automático</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {currentModule.lessons.map((les, idx) => (
                  <div 
                    key={les.id} 
                    style={{ 
                      padding: '14px 16px', 
                      background: 'var(--paper-2)', 
                      borderRadius: '8px', 
                      border: '1px solid var(--line-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span className="rank" style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontWeight: 700, display: 'grid', placeItems: 'center' }}>
                        {idx + 1}
                      </span>
                      <div>
                        <b style={{ fontSize: '14px', color: 'var(--ink)' }}>{les.titulo}</b>
                        <div className="muted" style={{ fontSize: '12px', marginTop: '2px' }}>
                          {les.prof} · Duração: {les.duracao} · URL: <small>{les.videoUrl}</small>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn sm outline" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Edit size={13} /> Editar
                      </button>
                      <button 
                        className="btn sm" 
                        onClick={() => handleDeleteLesson(les.id)}
                        style={{ color: 'var(--crit)', borderColor: 'var(--crit)', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Trash2 size={13} /> Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: CONSTRUTOR DE PROVAS E QUESTÕES & LIBERAÇÃO DE RECUPERAÇÃO */}
        {activeTab === 'exams' && (
          <div>
            {/* SEÇÃO DE LIBERAÇÃO DE PROVA / RECUPERAÇÃO PARA ALUNOS REPROVADOS < 6.0 */}
            <div className="card" style={{ marginBottom: '20px', border: '1px solid var(--accent)' }}>
              <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ink)' }}>
                    <ShieldAlert size={20} style={{ color: 'var(--warn)' }} /> 
                    Solicitações de Liberação de Prova (Alunos Reprovados &lt; 6.0)
                  </h3>
                  <p className="muted" style={{ fontSize: '13px', margin: '4px 0 0' }}>
                    Alunos que obtiveram nota inferior a 6.0 precisam de liberação da Coordenação para refazer a matéria e a prova final.
                  </p>
                </div>
                <span className="pill warn">{retakeRequests.filter(r => r.status === 'PENDENTE').length} Pendentes</span>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {retakeRequests.length === 0 ? (
                  <p className="muted" style={{ fontSize: '13px' }}>Nenhuma solicitação de recuperação pendente no momento.</p>
                ) : (
                  retakeRequests.map((req) => (
                    <div 
                      key={req.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '12px 16px', 
                        borderRadius: '8px', 
                        border: req.status === 'PENDENTE' ? '1px solid var(--warn)' : '1px solid var(--good)',
                        background: req.status === 'PENDENTE' ? 'var(--warn-soft)' : 'var(--good-soft)'
                      }}
                    >
                      <div>
                        <b style={{ fontSize: '14px', display: 'block' }}>{req.studentName} — {req.moduleName}</b>
                        <span style={{ fontSize: '12px', color: 'var(--ink-2)' }}>
                          Nota na prova: <b style={{ color: 'var(--crit)' }}>{req.score} / 10.0</b> (Reprovado) · Solicitação enviada {req.date}
                        </span>
                      </div>

                      {req.status === 'PENDENTE' ? (
                        <button 
                          className="btn primary sm" 
                          onClick={() => {
                            approveRetake(req.id);
                            setToastMessage(`🔓 Nova tentativa liberada para ${req.studentName} em ${req.moduleName}!`);
                            setTimeout(() => setToastMessage(null), 4000);
                          }}
                          style={{ background: 'var(--warn)', borderColor: 'var(--warn)' }}
                        >
                          🔓 Liberar Prova para o Aluno Refazer
                        </button>
                      ) : (
                        <span className="pill good" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={13} /> Prova Liberada pela Faculdade
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Criar Nova Avaliação / Questão de Prova</h3>
                <p className="muted" style={{ fontSize: '13px' }}>Cadastre questões objetivas para a Prova Final de Conclusão de Matéria.</p>
              </div>

              <button 
                className="btn primary"
                onClick={() => setShowAddExamModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> + Cadastrar Questão de Prova
              </button>
            </div>

            <div className="card">
              <h3>Questões Cadastradas no Módulo ({currentModule.nome})</h3>
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ padding: '14px', background: 'var(--paper-2)', borderRadius: '8px', border: '1px solid var(--line-2)' }}>
                  <b>Q1 · Em relação ao exame físico cardiovascular e identificação de sopros funcionais:</b>
                  <div style={{ fontSize: '13px', marginTop: '6px', color: 'var(--good)' }}>✓ Gabarito: Alternativa A</div>
                </div>
                <div style={{ padding: '14px', background: 'var(--paper-2)', borderRadius: '8px', border: '1px solid var(--line-2)' }}>
                  <b>Q2 · Durante a anamnese de um paciente com queixa de dispneia:</b>
                  <div style={{ fontSize: '13px', marginTop: '6px', color: 'var(--good)' }}>✓ Gabarito: Alternativa A</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 3: CURSOS E MATÉRIAS */}
        {activeTab === 'courses' && (
          <div className="card">
            <h3>Cursos Ativos em {tenantName}</h3>
            <p className="muted" style={{ fontSize: '13px', marginBottom: '16px' }}>Estrutura de cursos e matrizes curriculares gerenciadas pelo Administrador.</p>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <th style={{ padding: '10px' }}>Curso</th>
                  <th style={{ padding: '10px' }}>Status</th>
                  <th style={{ padding: '10px' }}>Carga Horária</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--line-2)' }}>
                  <td style={{ padding: '12px 10px' }}><b>Medicina</b></td>
                  <td style={{ padding: '12px 10px' }}><span className="pill good">Ativo</span></td>
                  <td style={{ padding: '12px 10px' }}>7.200 horas</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                    <button className="btn sm">Editar Grade</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* MODAL CADASTRAR NOVA VIDEOAULA */}
        {showAddLessonModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
            <form className="card" onSubmit={handleAddLesson} style={{ width: '560px', maxWidth: '90vw' }}>
              <h3>+ Cadastrar Nova Videoaula — {currentModule.nome}</h3>
              <p className="muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
                Preencha os dados da videoaula. Ela será adicionada à grade do módulo para os alunos do {tenantName}.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="field">
                  <label>Título da Aula</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Aula 5: Exame Físico Neurológico" 
                    value={newLessonTitle}
                    onChange={(e) => setNewLessonTitle(e.target.value)}
                    required 
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="field">
                    <label>Professor Responsável</label>
                    <input 
                      type="text" 
                      value={newLessonProf}
                      onChange={(e) => setNewLessonProf(e.target.value)}
                      required 
                    />
                  </div>

                  <div className="field">
                    <label>Duração (ex: 45 min)</label>
                    <input 
                      type="text" 
                      value={newLessonDuration}
                      onChange={(e) => setNewLessonDuration(e.target.value)}
                      required 
                    />
                  </div>
                </div>

                <div className="field">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                    <Upload size={16} /> Upload do Arquivo de Vídeo (MP4, WebM)
                  </label>
                  
                  <div style={{ border: '2px dashed var(--line)', borderRadius: '10px', padding: '16px', textAlign: 'center', background: 'var(--paper-2)', position: 'relative' }}>
                    <input 
                      type="file" 
                      accept="video/mp4,video/webm,video/mkv,video/mov,video/*"
                      onChange={handleVideoFileChange}
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                    />
                    <FileVideo size={32} style={{ color: 'var(--accent)', margin: '0 auto 6px' }} />
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>
                      {uploading ? 'Enviando vídeo para a plataforma...' : selectedFileName ? `Arquivo: ${selectedFileName}` : 'Clique ou arraste o vídeo aqui para fazer o upload'}
                    </div>
                    <small className="muted" style={{ fontSize: '11px' }}>Suporta MP4, WebM e MKV até 500MB</small>

                    {uploading && (
                      <div style={{ marginTop: '10px', background: 'var(--line)', borderRadius: '10px', overflow: 'hidden', height: '8px' }}>
                        <div style={{ width: `${uploadProgress}%`, background: 'var(--accent)', height: '100%', transition: 'width 0.2s ease' }} />
                      </div>
                    )}

                    {newLessonVideoUrl && !uploading && (
                      <div style={{ marginTop: '8px', color: 'var(--good)', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontWeight: 600 }}>
                        <Check size={14} /> Upload concluído com sucesso!
                      </div>
                    )}
                  </div>
                </div>

                {newLessonVideoUrl && (
                  <div className="field">
                    <label>Pré-visualização do Vídeo Uploadado</label>
                    <video 
                      controls 
                      src={newLessonVideoUrl} 
                      style={{ width: '100%', borderRadius: '8px', maxHeight: '180px', background: '#000' }}
                    />
                  </div>
                )}

                <div className="field">
                  <label>URL Direta do Vídeo (opcional se fez upload)</label>
                  <input 
                    type="text" 
                    placeholder="http://localhost:3001/uploads/videos/seu-video.mp4"
                    value={newLessonVideoUrl}
                    onChange={(e) => setNewLessonVideoUrl(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Descrição / Tópicos da Aula</label>
                  <textarea 
                    rows={3}
                    placeholder="Resumo dos assuntos que o aluno aprenderá nesta aula..."
                    value={newLessonDesc}
                    onChange={(e) => setNewLessonDesc(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn" onClick={() => setShowAddLessonModal(false)}>Cancelar</button>
                <button type="submit" className="btn primary">Salvar Videoaula</button>
              </div>
            </form>
          </div>
        )}

        {/* MODAL CADASTRAR NOVA QUESTÃO DE PROVA */}
        {showAddExamModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
            <form 
              className="card" 
              onSubmit={(e) => {
                e.preventDefault();
                setShowAddExamModal(false);
                alert('Questão cadastrada na Prova da Faculdade!');
              }} 
              style={{ width: '600px', maxWidth: '90vw' }}
            >
              <h3>+ Cadastrar Questão de Prova — {currentModule.nome}</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
                <div className="field">
                  <label>Enunciado da Questão</label>
                  <textarea 
                    rows={3} 
                    placeholder="Digite o caso clínico ou enunciado da pergunta..." 
                    value={newQuestionEnunciado}
                    onChange={(e) => setNewQuestionEnunciado(e.target.value)}
                    required 
                  />
                </div>

                <div className="field">
                  <label>Alternativa A</label>
                  <input type="text" value={newAltA} onChange={(e) => setNewAltA(e.target.value)} required />
                </div>

                <div className="field">
                  <label>Alternativa B</label>
                  <input type="text" value={newAltB} onChange={(e) => setNewAltB(e.target.value)} required />
                </div>

                <div className="field">
                  <label>Alternativa C</label>
                  <input type="text" value={newAltC} onChange={(e) => setNewAltC(e.target.value)} required />
                </div>

                <div className="field">
                  <label>Alternativa D</label>
                  <input type="text" value={newAltD} onChange={(e) => setNewAltD(e.target.value)} required />
                </div>

                <div className="field">
                  <label>Gabarito (Alternativa Correta)</label>
                  <select value={correctAlt} onChange={(e) => setCorrectAlt(Number(e.target.value))}>
                    <option value={0}>Alternativa A</option>
                    <option value={1}>Alternativa B</option>
                    <option value={2}>Alternativa C</option>
                    <option value={3}>Alternativa D</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn" onClick={() => setShowAddExamModal(false)}>Cancelar</button>
                <button type="submit" className="btn primary">Salvar Questão</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
