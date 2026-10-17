import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Download, FileText, LockKeyhole, Play } from 'lucide-react';
import { TopBar } from '../../components/TopBar';
import api from '../../api/client';
import './LessonPlayer.css';

type LessonListItem = { id: string; titulo: string; position?: number; completed?: boolean; locked?: boolean };
type Attachment = { id: string; filename: string; mimeType: string; size: number; downloadUrl: string };
type LessonRecord = { id: string; titulo: string; desc?: string; prof?: string; duracao?: string; videoUrl?: string | null; pdfUrl?: string | null; completed?: boolean; locked?: boolean; attachments?: Attachment[]; module?: { nome: string; lessons?: LessonListItem[]; finalExam?: { id: string; nome: string } | null; finalExamLocked?: boolean } };

export const LessonPlayer: React.FC<{ lessonId?: string; onBack: () => void; onOpenExam?: (examId: string) => void }> = ({ lessonId, onBack, onOpenExam }) => {
  const [selectedId, setSelectedId] = useState(lessonId);
  const [lesson, setLesson] = useState<LessonRecord | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [videoError, setVideoError] = useState(false);
  const [actionError, setActionError] = useState('');
  const [completing, setCompleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { setSelectedId(lessonId); }, [lessonId]);
  useEffect(() => {
    let active = true; setLesson(null); setVideoError(false); setActionError('');
    if (!selectedId) { setStatus('ready'); return () => { active = false; }; }
    setStatus('loading');
    api.get<LessonRecord>('/lessons/' + encodeURIComponent(selectedId))
      .then(response => { if (active) { setLesson(response.data); setStatus('ready'); } })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [selectedId, refresh]);
  const playlist = (lesson?.module?.lessons || []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const next = playlist.find((item, index) => index > playlist.findIndex(candidate => candidate.id === selectedId) && !item.locked);
  const pdfUrl = lesson?.pdfUrl && (/^https:\/\//i.test(lesson.pdfUrl) || /^\/(?:api\/)?uploads\/[\w./-]+$/.test(lesson.pdfUrl)) ? lesson.pdfUrl : null;
  const embedUrl = (() => { try { const url = new URL(lesson?.videoUrl || ''); return url.protocol === 'https:' && ((['www.youtube.com', 'www.youtube-nocookie.com', 'youtube.com'].includes(url.hostname) && url.pathname.startsWith('/embed/')) || (url.hostname === 'player.vimeo.com' && url.pathname.startsWith('/video/'))) ? url.href : null; } catch { return null; } })();
  const complete = async () => {
    if (!lesson || completing) return;
    setCompleting(true); setActionError('');
    try { await api.post('/lessons/' + encodeURIComponent(lesson.id) + '/complete'); setRefresh(value => value + 1); }
    catch (error: any) { setActionError(error.response?.data?.error || 'Não foi possível concluir a aula. Tente novamente.'); }
    finally { setCompleting(false); }
  };
  const download = async (attachment: Attachment) => {
    setDownloadingId(attachment.id); setActionError('');
    try {
      const response = await api.get(attachment.downloadUrl.replace(/^\/api\//, '/'), { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a'); link.href = url; link.download = attachment.filename; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setActionError('Não foi possível baixar o arquivo. Atualize a aula e tente novamente.'); }
    finally { setDownloadingId(''); }
  };
  return <div><TopBar currentPage="Videoaula" /><section className="unit-setup lesson-journey"><button className="btn lesson-back" onClick={onBack}><ArrowLeft size={16} /> Voltar à matéria</button>
    {status === 'loading' ? <p role="status">Carregando aula…</p> : status === 'error' ? <section className="card" role="alert"><h2>Não foi possível carregar a aula</h2><p>A aula pode estar indisponível ou ainda bloqueada na sequência.</p><button className="btn" onClick={() => setRefresh(value => value + 1)}>Tentar novamente</button></section> : !lesson ? <section className="card"><h2>Nenhuma aula selecionada</h2><p>Selecione uma aula publicada para começar.</p></section> : <>
      <div className="lesson-heading"><p className="eyebrow">{lesson.module?.nome || 'Matéria'} · Aula {Math.max(1, playlist.findIndex(item => item.id === lesson.id) + 1)} de {playlist.length}</p><h1>{lesson.titulo}</h1><p>{[lesson.prof, lesson.duracao].filter(Boolean).join(' · ')}</p></div>
      <div className="lesson-layout"><main className="lesson-main"><div className="lesson-video">{lesson.locked ? <div className="lesson-video-empty"><LockKeyhole size={35} /><p>Conclua a aula anterior para liberar este conteúdo.</p></div> : lesson.videoUrl ? embedUrl ? <iframe src={embedUrl} title={lesson.titulo} allowFullScreen referrerPolicy="no-referrer" /> : <video key={lesson.videoUrl} src={lesson.videoUrl} controls preload="metadata" onError={() => setVideoError(true)} /> : <div className="lesson-video-empty"><Play size={35} /><p>Esta aula ainda não possui vídeo disponível.</p></div>}</div>{videoError && <p role="alert" className="inline-form-error">O vídeo não pôde ser reproduzido. O link pode ter expirado.</p>}
        <div className="lesson-main-actions"><div>{lesson.completed ? <span className="lesson-complete-label"><CheckCircle2 size={17} /> Aula concluída</span> : <span>Depois de estudar, registre a conclusão para liberar a próxima aula.</span>}</div>{!lesson.completed && !lesson.locked && <button className="btn primary" disabled={completing} onClick={() => void complete()}>{completing ? 'Concluindo…' : 'Marcar como concluída'}</button>}{lesson.completed && next && <button className="btn primary" onClick={() => setSelectedId(next.id)}>Próxima aula <ArrowRight size={16} /></button>}</div>
        {actionError && <p className="inline-form-error" role="alert">{actionError}</p>}
        {lesson.desc && <section className="lesson-notes"><h2>Sobre esta aula</h2><p>{lesson.desc}</p></section>}
        {(lesson.attachments?.length || pdfUrl) && <section className="lesson-resources"><h2>Materiais para atividade</h2><p>Baixe os arquivos disponibilizados pela instituição para acompanhar e realizar a atividade.</p>{lesson.attachments?.map(attachment => <button key={attachment.id} className="lesson-resource" disabled={!!downloadingId} onClick={() => void download(attachment)}><FileText size={18} /><span>{attachment.filename}</span><Download size={17} aria-label={downloadingId === attachment.id ? 'Baixando' : 'Baixar'} /></button>)}{pdfUrl && <a className="lesson-resource" href={pdfUrl} target="_blank" rel="noopener noreferrer"><FileText size={18} /><span>Material PDF da aula</span><Download size={17} /></a>}</section>}
      </main><aside className="lesson-playlist" aria-label="Aulas da matéria"><div className="lesson-playlist-head"><strong>Sua sequência</strong><span>{playlist.filter(item => item.completed).length}/{playlist.length}</span></div><ol>{playlist.map((item, index) => <li key={item.id}><button className={item.id === selectedId ? 'current' : ''} disabled={item.locked || item.id === selectedId} onClick={() => setSelectedId(item.id)}><span className="lesson-playlist-icon">{item.completed ? <CheckCircle2 size={17} /> : item.locked ? <LockKeyhole size={15} /> : String(index + 1).padStart(2, '0')}</span><span><strong>{item.titulo}</strong><small>{item.completed ? 'Concluída' : item.locked ? 'Bloqueada' : item.id === selectedId ? 'Em andamento' : 'Disponível'}</small></span></button></li>)}</ol>{lesson.module?.finalExam && <button className="lesson-playlist-final" disabled={lesson.module.finalExamLocked || !onOpenExam} onClick={() => onOpenExam?.(lesson.module!.finalExam!.id)}><FileText size={18} /><span><strong>{lesson.module.finalExam.nome}</strong><small>{lesson.module.finalExamLocked ? 'Libera após todas as aulas' : 'Avaliação final'}</small></span>{lesson.module.finalExamLocked && <LockKeyhole size={15} />}</button>}</aside></div>
    </>}
  </section></div>;
};
