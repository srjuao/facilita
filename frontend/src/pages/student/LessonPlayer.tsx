import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useCourse } from '../../context/CourseContext';
import { TopBar } from '../../components/TopBar';
import { CertificateModal } from '../../components/CertificateModal';
import { Play, CheckCircle, FileText, BookOpen, ChevronLeft, Lock, ArrowRight, CheckCircle2, AlertCircle, Award, X, Clock } from 'lucide-react';
import api from '../../api/client';

interface LessonPlayerProps {
  lessonId?: string;
  onBack: () => void;
}

export const LessonPlayer: React.FC<LessonPlayerProps> = ({ lessonId = 'les_1', onBack }) => {
  const { user, markModuleCompleted, completedModules } = useAuth();
  const { modules, requestRetake, completedLessonIds, markLessonCompleted, toggleLessonCompleted } = useCourse();
  const [activeTab, setActiveTab] = useState<'overview' | 'pdf' | 'ia' | 'notes'>('overview');
  const [lesson, setLesson] = useState<any>(null);
  const [currentLessonId, setCurrentLessonId] = useState<string>(lessonId);
  const [notes, setNotes] = useState<string>('');
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Estado do Simulado / Prova Final
  const [showExamModal, setShowExamModal] = useState<boolean>(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [examFinished, setExamFinished] = useState<boolean>(false);
  const [examScore, setExamScore] = useState<number>(0);
  const [examPassed, setExamPassed] = useState<boolean>(false);
  const [showCertificate, setShowCertificate] = useState<boolean>(false);

  useEffect(() => {
    if (lessonId) {
      setCurrentLessonId(lessonId);
    }
  }, [lessonId]);

  useEffect(() => {
    // Buscar a aula nos módulos compartilhados
    const targetId = currentLessonId || lessonId;
    let foundLesson: any = null;
    let parentModule: any = null;

    if (targetId) {
      for (const mod of modules) {
        const match = mod.lessons.find(l => l.id === targetId);
        if (match) {
          foundLesson = match;
          parentModule = mod;
          break;
        }
      }
    }

    if (!foundLesson && lessonId) {
      for (const mod of modules) {
        const match = mod.lessons.find(l => l.id === lessonId);
        if (match) {
          foundLesson = match;
          parentModule = mod;
          break;
        }
      }
    }

    if (foundLesson && parentModule) {
      setLesson({
        ...foundLesson,
        module: {
          nome: parentModule.nome,
          lessons: parentModule.lessons
        }
      });
    } else {
      // Fallback API / Mock
      api.get(`/lessons/${currentLessonId}`)
        .then(res => setLesson(res.data))
        .catch(() => {
          const defaultMod = modules[0];
          setLesson({
            id: currentLessonId,
            titulo: 'Semiologia Geral — Aula 1: Introdução ao Exame Físico',
            desc: 'Nesta aula abordaremos os conceitos fundamentais de anamnese, posicionamento do paciente, inspeção geral e sinais vitais primários.',
            duracao: '45 min',
            prof: 'Prof. Dr. Sérgio Amaral',
            videoUrl: 'http://localhost:3001/uploads/videos/aula1_semiologia.mp4',
            module: {
              nome: defaultMod ? defaultMod.nome : 'Semiologia Geral',
              lessons: defaultMod ? defaultMod.lessons : []
            }
          });
        });
    }
  }, [currentLessonId, lessonId, modules]);

  if (!lesson) return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando videoaula...</div>;

  const playlist = lesson.module?.lessons || [];
  const isCurrentCompleted = completedLessonIds.includes(currentLessonId);

  // Encontrar o índice da aula atual
  const currentIdx = playlist.findIndex((l: any) => l.id === currentLessonId);
  const nextLesson = currentIdx !== -1 && currentIdx < playlist.length - 1 ? playlist[currentIdx + 1] : null;

  // Checar se todas as aulas do módulo estão concluídas para liberar a Prova Final
  const allLessonsCompleted = playlist.every((l: any) => completedLessonIds.includes(l.id));

  // Questões da Prova Final da Matéria
  const examQuestions = [
    {
      id: 1,
      enunciado: 'Em relação ao exame físico cardiovascular e identificação de sopros funcionais vs patológicos, assinale a opção correta:',
      alternativas: [
        'Sopros sistólicos de grau I/II sem irradiação e sem sintomas associados são frequentemente inocentes/funcionais em jovens.',
        'Todo sopro diastólico deve ser considerado estritamente fisiológico em pacientes sem histórico de febre reumática.',
        'O foco aórtico situa-se no 5º espaço intercostal esquerdo na linha hemiclavicular.',
        'A manobra de Valsalva sempre reduz a intensidade do sopro da cardiomiopatia hipertrófica.'
      ]
    },
    {
      id: 2,
      enunciado: 'Durante a anamnese de um paciente com queixa de dispneia, qual dado da história clínica sugere etiologia cardíaca em vez de pulmonar?',
      alternativas: [
        'Ortopneia e dispneia paroxística noturna acompanhadas de edema de membros inferiores.',
        'Tosse produtiva purulenta com expectoração amarelada há 3 semanas.',
        'Sibilância expiratória difusa relacionada a mudanças de temperatura.',
        'Dor torácica pleurítica que piora com a inspiração profunda.'
      ]
    },
    {
      id: 3,
      enunciado: 'Na avaliação dos sinais vitais, qual das alternativas representa uma técnica adequada para a mensuração da pressão arterial?',
      alternativas: [
        'O manguito deve cobrir pelo menos 80% da circunferência do braço e a artéria braquial deve estar no nível do coração.',
        'A pressão sistólica corresponde ao V som de Korotkoff na ausculta com estetoscópio.',
        'Deve-se insuflar o manguito 50 mmHg acima do desaparecimento do pulso radial.',
        'O paciente pode falar normalmente durante a medição sem alterar os resultados.'
      ]
    }
  ];

  // Função para checar se uma aula está desbloqueada ou já assistida
  const isLessonUnlocked = (idx: number) => {
    if (idx === 0) return true; // Primeira aula sempre liberada
    const target = playlist[idx];
    if (target && completedLessonIds.includes(target.id)) return true; // Se já foi assistida, SEMPRE liberada para assistir novamente!
    if (target && (target.id === currentLessonId || target.id === lessonId)) return true; // Aula explicitamente aberta
    const prevLesson = playlist[idx - 1];
    return prevLesson && completedLessonIds.includes(prevLesson.id);
  };

  // Alternar conclusão da aula atual
  const handleToggleComplete = () => {
    toggleLessonCompleted(currentLessonId);
    if (!isCurrentCompleted) {
      showToast('🎉 Aula concluída! Você pode assisti-la novamente quantas vezes quiser.');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSelectLesson = (item: any, idx: number) => {
    if (isLessonUnlocked(idx)) {
      setCurrentLessonId(item.id);
    } else {
      showToast('🔒 Esta aula está bloqueada! Assista e conclua a aula anterior para avançar.');
    }
  };

  const handleOpenFinalExam = () => {
    if (allLessonsCompleted) {
      setShowExamModal(true);
      setExamFinished(false);
      setCurrentQuestionIdx(0);
    } else {
      showToast('🔒 Prova Bloqueada! Você precisa concluir todas as aulas do módulo para liberar a Prova Final.');
    }
  };

  const handleSelectOption = (qIdx: number, optIdx: number) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [qIdx]: optIdx
    });
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      <TopBar currentPage={`Aula: ${lesson.titulo}`} />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div 
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 999,
            background: toastMessage.includes('🔒') ? 'var(--warn-soft)' : 'var(--good-soft)',
            color: toastMessage.includes('🔒') ? 'var(--warn)' : 'var(--good)',
            border: `1px solid ${toastMessage.includes('🔒') ? 'var(--warn)' : 'var(--good)'}`,
            padding: '12px 18px',
            borderRadius: '8px',
            boxShadow: 'var(--shadow)',
            fontWeight: 600,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {toastMessage.includes('🔒') ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          {toastMessage}
        </div>
      )}

      <div style={{ padding: '0 28px' }}>
        {/* Voltar e Conclusão */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <button 
            className="btn ghost sm" 
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
          >
            <ChevronLeft size={16} /> Voltar para matérias
          </button>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              className={`btn ${isCurrentCompleted ? 'primary' : 'outline'}`}
              onClick={handleToggleComplete}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <CheckCircle size={16} /> {isCurrentCompleted ? 'Aula Concluída ✓' : 'Marcar como concluída'}
            </button>

            {nextLesson && isCurrentCompleted && (
              <button 
                className="btn primary"
                onClick={() => setCurrentLessonId(nextLesson.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                Próxima Aula <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Layout de Vídeo + Playlist Sequencial + Prova Final */}
        <div className="grid g32" style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: '20px', marginBottom: '24px' }}>
          {/* Player do Vídeo */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', background: '#000', borderRadius: '12px' }}>
            <div style={{ position: 'relative', paddingTop: '56.25%', width: '100%' }}>
              {(lesson.videoUrl && (lesson.videoUrl.includes('/uploads/') || lesson.videoUrl.endsWith('.mp4') || lesson.videoUrl.endsWith('.webm') || !lesson.videoUrl.includes('youtube') && !lesson.videoUrl.includes('embed'))) ? (
                <video
                  key={lesson.id || lesson.videoUrl}
                  controls
                  controlsList="nodownload"
                  src={lesson.videoUrl}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0, background: '#000' }}
                  onEnded={() => {
                    if (!completedLessonIds.includes(currentLessonId)) {
                      markLessonCompleted(currentLessonId);
                      showToast('🎉 Aula concluída! Você pode assisti-la novamente sempre que desejar.');
                    }
                  }}
                />
              ) : (
                <iframe
                  src={lesson.videoUrl || 'http://localhost:3001/uploads/videos/aula1_semiologia.mp4'}
                  title={lesson.titulo}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
            <div style={{ padding: '16px 20px', background: 'var(--paper)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="pill info" style={{ marginBottom: '6px' }}>{lesson.module?.nome || 'Módulo'}</span>
                {isCurrentCompleted && <span className="pill good">Aula concluída ✓</span>}
              </div>
              <h2 style={{ fontSize: '20px', margin: '4px 0' }}>{lesson.titulo}</h2>
              <div className="muted" style={{ fontSize: '13px' }}>
                {lesson.prof} · Duração: {lesson.duracao}
              </div>
            </div>
          </div>

          {/* Playlist da Turma com Trava Sequencial + Prova Final */}
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={16} /> Aulas deste módulo ({playlist.length})
              </h3>
              <small className="muted" style={{ fontSize: '11px' }}>
                Assista e conclua todas as aulas para liberar a Prova Final.
              </small>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '380px' }}>
              {playlist.map((item: any, idx: number) => {
                const isUnlocked = isLessonUnlocked(idx);
                const isCompletedItem = completedLessonIds.includes(item.id);
                const isSelected = item.id === currentLessonId;

                return (
                  <div
                    key={item.id || idx}
                    onClick={() => handleSelectLesson(item, idx)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--line-2)',
                      background: isSelected ? 'var(--accent-soft)' : !isUnlocked ? 'var(--paper-2)' : 'var(--paper)',
                      cursor: isUnlocked ? 'pointer' : 'not-allowed',
                      opacity: !isUnlocked ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span 
                      className="rank" 
                      style={{ 
                        fontSize: '12px', 
                        width: '24px', 
                        height: '24px', 
                        display: 'grid', 
                        placeItems: 'center', 
                        background: isCompletedItem ? 'var(--good-soft)' : !isUnlocked ? 'var(--paper-2)' : 'var(--accent-soft)',
                        color: isCompletedItem ? 'var(--good)' : !isUnlocked ? 'var(--muted)' : 'var(--accent-ink)',
                        borderRadius: '50%' 
                      }}
                    >
                      {isCompletedItem ? <CheckCircle2 size={14} /> : !isUnlocked ? <Lock size={12} /> : idx + 1}
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: isSelected ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: !isUnlocked ? 'var(--muted)' : 'var(--ink)' }}>
                        {item.titulo}
                      </div>
                      <small className="muted">{item.duracao || '45 min'}</small>
                    </div>

                    {isSelected && <Play size={14} style={{ color: 'var(--accent)' }} />}
                    {!isUnlocked && <Lock size={14} style={{ color: 'var(--muted)' }} />}
                  </div>
                );
              })}

              {/* ITEM DA PROVA OBRIGATÓRIA DE FINAL DE MATÉRIA */}
              <div
                onClick={handleOpenFinalExam}
                style={{
                  marginTop: '8px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: completedModules.includes(lesson.module?.nome || '') ? '1px solid var(--good)' : allLessonsCompleted ? '1px solid var(--accent)' : '1px dashed var(--line)',
                  background: completedModules.includes(lesson.module?.nome || '') ? 'var(--good-soft)' : allLessonsCompleted ? 'var(--accent-soft)' : 'var(--paper-2)',
                  cursor: allLessonsCompleted ? 'pointer' : 'not-allowed',
                  opacity: allLessonsCompleted ? 1 : 0.75,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <span className="rank" style={{ background: completedModules.includes(lesson.module?.nome || '') ? 'var(--good)' : allLessonsCompleted ? 'var(--accent)' : 'var(--paper)', color: '#fff', borderRadius: '50%', width: '26px', height: '26px', display: 'grid', placeItems: 'center' }}>
                  {completedModules.includes(lesson.module?.nome || '') ? <CheckCircle2 size={14} /> : allLessonsCompleted ? <Award size={14} /> : <Lock size={12} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: '12px', color: completedModules.includes(lesson.module?.nome || '') ? 'var(--good)' : allLessonsCompleted ? 'var(--accent-ink)' : 'var(--ink-2)', display: 'block' }}>
                    {completedModules.includes(lesson.module?.nome || '') ? 'MATÉRIA CONCLUÍDA ✓' : '📝 PROVA FINAL DA MATÉRIA'}
                  </b>
                  <small style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    {completedModules.includes(lesson.module?.nome || '') ? 'Aprovado com nota 8.5' : allLessonsCompleted ? 'Liberada para resposta!' : 'Bloqueada (conclua as 4 aulas)'}
                  </small>
                </div>
                <span className={`pill ${completedModules.includes(lesson.module?.nome || '') ? 'good' : allLessonsCompleted ? 'info' : 'neutral'}`} style={{ fontSize: '10px' }}>
                  {completedModules.includes(lesson.module?.nome || '') ? 'APROVADO' : allLessonsCompleted ? 'LIBERADA' : 'BLOQUEADA'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL DA PROVA FINAL DA MATÉRIA (DESIGN REFORMULADO E AMIPLO) */}
        {showExamModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(18, 33, 58, 0.7)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', zIndex: 100, padding: '20px' }}>
            <div className="card" style={{ width: '820px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', padding: '28px', position: 'relative' }}>
              {/* Botão de Fechar Modal */}
              <button 
                onClick={() => setShowExamModal(false)}
                style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: '50%', width: '32px', height: '32px', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--muted)' }}
              >
                <X size={18} />
              </button>

              {/* Cabeçalho do Modal */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center' }}>
                  <Award size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '20px', margin: 0 }}>Prova Final de Conclusão — {lesson.module?.nome}</h2>
                  <span className="muted" style={{ fontSize: '12px' }}>Avaliação Obrigatória da Universidade · Nota Mínima: 7,0</span>
                </div>
              </div>

              <hr style={{ border: 0, borderTop: '1px solid var(--line-2)', margin: '16px 0 20px' }} />

              {!examFinished ? (
                <div>
                  {/* Cronômetro e Contador de Questões */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: 'var(--paper-2)', padding: '12px 16px', borderRadius: '10px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-ink)' }}>
                      Questão {currentQuestionIdx + 1} de {examQuestions.length}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>
                      <Clock size={16} /> Tempo restante: 45:00 min
                    </div>
                  </div>

                  {/* Enunciado da Questão */}
                  <div style={{ marginBottom: '20px' }}>
                    <p style={{ fontSize: '16px', lineHeight: 1.5, fontWeight: 600, color: 'var(--ink)' }}>
                      {examQuestions[currentQuestionIdx].enunciado}
                    </p>
                  </div>

                  {/* Alternativas de Resposta Estilizadas em Cards Amplos */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                    {examQuestions[currentQuestionIdx].alternativas.map((altText, optIdx) => {
                      const isSelected = selectedAnswers[currentQuestionIdx] === optIdx;
                      const optionLetters = ['A', 'B', 'C', 'D'];

                      return (
                        <div
                          key={optIdx}
                          onClick={() => handleSelectOption(currentQuestionIdx, optIdx)}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '14px',
                            padding: '14px 16px',
                            borderRadius: '10px',
                            border: isSelected ? '2px solid var(--accent)' : '1px solid var(--line)',
                            background: isSelected ? 'var(--accent-soft)' : 'var(--paper)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease-in-out'
                          }}
                        >
                          <span 
                            style={{ 
                              width: '28px', 
                              height: '28px', 
                              borderRadius: '50%', 
                              background: isSelected ? 'var(--accent)' : 'var(--paper-2)', 
                              color: isSelected ? '#fff' : 'var(--ink-2)', 
                              fontWeight: 700, 
                              fontSize: '13px', 
                              display: 'grid', 
                              placeItems: 'center',
                              flex: 'none'
                            }}
                          >
                            {optionLetters[optIdx]}
                          </span>

                          <div style={{ flex: 1, fontSize: '14px', lineHeight: 1.5, color: isSelected ? 'var(--accent-ink)' : 'var(--ink)', fontWeight: isSelected ? 600 : 400 }}>
                            {altText}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Rodapé com Navegação entre Questões */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--line-2)' }}>
                    <button 
                      className="btn outline"
                      disabled={currentQuestionIdx === 0}
                      onClick={() => setCurrentQuestionIdx(currentQuestionIdx - 1)}
                      style={{ opacity: currentQuestionIdx === 0 ? 0.5 : 1 }}
                    >
                      Anterior
                    </button>

                    {currentQuestionIdx < examQuestions.length - 1 ? (
                      <button 
                        className="btn primary"
                        onClick={() => setCurrentQuestionIdx(currentQuestionIdx + 1)}
                      >
                        Próxima Questão →
                      </button>
                    ) : (
                      <button 
                        className="btn primary"
                        onClick={() => {
                          // Calcular Nota Real da Prova
                          const correctMap: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
                          let correctCount = 0;
                          examQuestions.forEach((_, idx) => {
                            if (selectedAnswers[idx] === (correctMap[idx] ?? 0)) {
                              correctCount++;
                            }
                          });

                          const calcScore = Math.round((correctCount / examQuestions.length) * 10 * 10) / 10;
                          setExamScore(calcScore);

                          if (calcScore >= 6.0) {
                            setExamPassed(true);
                            markModuleCompleted(lesson.module?.nome || 'Semiologia Geral');
                          } else {
                            setExamPassed(false);
                            requestRetake(user?.nome || 'João Silva', lesson.module?.nome || 'Semiologia Geral', calcScore);
                          }
                          setExamFinished(true);
                        }}
                        style={{ background: 'var(--good)', borderColor: 'var(--good)' }}
                      >
                        Finalizar e Enviar Prova
                      </button>
                    )}
                  </div>
                </div>
              ) : examPassed ? (
                /* RESULTADO DA PROVA: APROVADO (NOTA >= 6.0) */
                <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                  <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--good-soft)', color: 'var(--good)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                    <CheckCircle2 size={40} />
                  </div>
                  <h2 style={{ color: 'var(--good)', fontSize: '24px' }}>Parabéns! Você foi Aprovado(a)!</h2>
                  <p style={{ fontSize: '15px', color: 'var(--ink-2)', margin: '10px 0 20px', maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
                    Sua nota final foi <b style={{ color: 'var(--good)' }}>{examScore} / 10.0</b> (Mínimo requerido: 6.0). Você concluiu com êxito a matéria de <b>{lesson.module?.nome}</b>!
                  </p>
                  
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button className="btn primary" onClick={() => setShowCertificate(true)}>
                      🏆 Gerar Certificado Digital
                    </button>
                    <button className="btn outline" onClick={() => setShowExamModal(false)}>
                      Concluir e Retornar
                    </button>
                  </div>
                </div>
              ) : (
                /* RESULTADO DA PROVA: REPROVADO (NOTA < 6.0) */
                <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                  <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--crit-soft)', color: 'var(--crit)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                    <AlertCircle size={40} />
                  </div>
                  <h2 style={{ color: 'var(--crit)', fontSize: '24px' }}>Desempenho Insuficiente — Reprovado(a)</h2>
                  <p style={{ fontSize: '15px', color: 'var(--ink-2)', margin: '10px 0 16px', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' }}>
                    Sua nota final foi <b style={{ color: 'var(--crit)' }}>{examScore} / 10.0</b>. Como você obteve nota <b>abaixo de 6.0</b>, não foi aprovado(a) na matéria de <b>{lesson.module?.nome}</b>.
                  </p>

                  <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: '10px', padding: '16px', margin: '0 auto 20px', maxWidth: '500px', textAlign: 'left', fontSize: '13px', color: 'var(--ink-2)' }}>
                    <b style={{ color: 'var(--warn)', display: 'block', marginBottom: '4px' }}>🔒 Refazer a Matéria & Nova Tentativa:</b>
                    De acordo com o regulamento acadêmico, você precisará refazer o conteúdo e solicitar a <b>liberação do Administrador / Coordenação da Faculdade</b> para realizar uma nova tentativa de prova.
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button className="btn primary" style={{ background: 'var(--warn)', borderColor: 'var(--warn)' }} onClick={() => {
                      showToast('📩 Solicitação de nova tentativa enviada para a Coordenação!');
                      setShowExamModal(false);
                    }}>
                      📩 Solicitar Liberação da Prova ao Adm
                    </button>
                    <button className="btn outline" onClick={() => setShowExamModal(false)}>
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal do Certificado Digital */}
        {showCertificate && (
          <CertificateModal
            studentName={user?.nome || 'João Silva'}
            courseName={user?.course?.nome || 'Medicina'}
            moduleName={lesson.module?.nome || 'Semiologia Geral'}
            tenantName={user?.tenant?.nome || 'UNIFAN — Centro Universitário Nobre'}
            onClose={() => setShowCertificate(false)}
          />
        )}

        {/* Abas Inferiores de Conteúdo */}
        <div className="card">
          <div className="filters" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--line-2)', paddingBottom: '12px', marginBottom: '16px' }}>
            <button 
              className={`chip ${activeTab === 'overview' ? 'on' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              📝 Visão Geral
            </button>
            <button 
              className={`chip ${activeTab === 'pdf' ? 'on' : ''}`}
              onClick={() => setActiveTab('pdf')}
            >
              📄 Material PDF
            </button>
            <button 
              className={`chip ${activeTab === 'ia' ? 'on' : ''}`}
              onClick={() => setActiveTab('ia')}
            >
              💬 Tirar Dúvida com IA
            </button>
            <button 
              className={`chip ${activeTab === 'notes' ? 'on' : ''}`}
              onClick={() => setActiveTab('notes')}
            >
              ✏️ Minhas Anotações
            </button>
          </div>

          {activeTab === 'overview' && (
            <div>
              <h3>Descrição da Aula</h3>
              <p style={{ marginTop: '8px', fontSize: '14px', lineHeight: 1.6, color: 'var(--ink-2)' }}>
                {lesson.desc}
              </p>
            </div>
          )}

          {activeTab === 'pdf' && (
            <div>
              <h3>Apostila e Material de Apoio</h3>
              <a href={lesson.pdfUrl || '#'} target="_blank" rel="noreferrer" className="btn primary sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} /> Baixar Apostila da Aula (PDF)
              </a>
            </div>
          )}

          {activeTab === 'ia' && (
            <div>
              <h3>Tirar Dúvida com IA sobre esta aula</h3>
              <div className="ask" style={{ display: 'flex', gap: '8px' }}>
                <input placeholder={`Pergunte algo sobre "${lesson.titulo}"...`} />
                <button className="btn primary">Perguntar</button>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div>
              <h3>Minhas Anotações Pessoais</h3>
              <textarea
                rows={5}
                placeholder="Escreva suas anotações da aula aqui..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--line)' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
