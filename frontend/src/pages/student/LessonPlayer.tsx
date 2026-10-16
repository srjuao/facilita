import React, { useEffect, useState } from 'react';
import { TopBar } from '../../components/TopBar';
import api from '../../api/client';
interface LessonRecord { id: string; titulo: string; desc?: string; prof?: string; duracao?: string; videoUrl?: string; pdfUrl?: string; module?: { nome: string; lessons?: { id: string; titulo: string }[] } }
export const LessonPlayer: React.FC<{ lessonId?: string; onBack: () => void }> = ({ lessonId, onBack }) => {
  const [selectedId, setSelectedId] = useState(lessonId);
  const [lesson, setLesson] = useState<LessonRecord | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [videoError, setVideoError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { setSelectedId(lessonId); }, [lessonId]);
  useEffect(() => {
    let active = true; setLesson(null); setVideoError(false);
    if (!selectedId) { setStatus('ready'); return () => { active = false; }; }
    setStatus('loading');
    api.get('/lessons/' + encodeURIComponent(selectedId)).then(response => { if (active) { setLesson(response.data); setStatus('ready'); } })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [selectedId, refresh]);
  const pdfUrl = lesson?.pdfUrl && (/^https:\/\//i.test(lesson.pdfUrl) || /^\/(?:api\/)?uploads\/[\w./-]+$/.test(lesson.pdfUrl)) ? lesson.pdfUrl : null;
  const embedUrl = (() => { try { const url = new URL(lesson?.videoUrl || ''); return url.protocol === 'https:' && ((['www.youtube.com', 'www.youtube-nocookie.com', 'youtube.com'].includes(url.hostname) && url.pathname.startsWith('/embed/')) || (url.hostname === 'player.vimeo.com' && url.pathname.startsWith('/video/'))) ? url.href : null; } catch { return null; } })();
  return <div><TopBar currentPage="Videoaula" /><section className="unit-setup"><button className="btn" onClick={onBack}>Voltar às aulas</button>
    {status === 'loading' ? <p role="status">Carregando aula…</p> : status === 'error' ? <section className="card" role="alert"><h2>Não foi possível carregar a aula</h2><p>A aula pode estar indisponível ou seu acesso não estar autorizado.</p><button className="btn" onClick={() => setRefresh(value => value + 1)}>Tentar novamente</button></section> : !lesson ? <section className="card"><h2>Nenhuma aula selecionada</h2><p>Selecione uma aula publicada para começar.</p></section> :
      <><div className="page-head"><div>{lesson.module?.nome && <p className="eyebrow">{lesson.module.nome}</p>}<h1>{lesson.titulo}</h1>{lesson.prof && <p>{lesson.prof}</p>}{lesson.duracao && <p>{lesson.duracao}</p>}</div></div>
        <section className="card">{lesson.videoUrl ? <>{embedUrl ? <iframe src={embedUrl} title={lesson.titulo} allowFullScreen referrerPolicy="no-referrer" style={{ width: '100%', aspectRatio: '16 / 9', border: 0 }} /> : <video key={lesson.videoUrl} src={lesson.videoUrl} controls preload="metadata" style={{ width: '100%', maxHeight: '65vh', background: '#102440' }} onError={() => setVideoError(true)} />}{videoError && <p role="alert">O vídeo não pôde ser reproduzido. O link pode ter expirado.</p>}<button className="btn" onClick={() => setRefresh(value => value + 1)}>Atualizar acesso ao vídeo</button></> : <p>Esta aula ainda não possui vídeo disponível.</p>}{pdfUrl && <p><a className="btn" href={pdfUrl} target="_blank" rel="noopener noreferrer">Abrir material PDF cadastrado</a></p>}{lesson.desc && <p style={{ whiteSpace: 'pre-wrap' }}>{lesson.desc}</p>}</section>
        {!!lesson.module?.lessons?.length && <section className="card" style={{ marginTop: 16 }}><h2>Aulas da matéria</h2>{lesson.module.lessons.map(item => <p key={item.id}><button className="btn" disabled={item.id === selectedId} onClick={() => setSelectedId(item.id)}>{item.titulo}</button></p>)}</section>}
      </>}
  </section></div>;
};
