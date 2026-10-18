import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BookOpen, CheckCheck, ClipboardList, FileText, X } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import './StudentNotifications.css';

type Notification = { id: string; kind: 'course' | 'notice' | 'exam'; sourceId: string; title: string; body: string; targetView: string; createdAt: string; readAt: string | null };
type Feed = { items: Notification[]; unreadCount: number; nextCursor: string | null };
const icon = { course: BookOpen, notice: FileText, exam: ClipboardList };
const label = { course: 'Curso', notice: 'Aviso', exam: 'Prova' };
const safeView = (value: string) => ['al-materias', 'al-store', 'al-notices', 'al-provas'].includes(value) ? value : 'al-inicio';

export const StudentNotifications: React.FC<{ onNavigate: (view: string) => void }> = ({ onNavigate }) => {
  const { user, refreshUser } = useAuth();
  const userId = user?.id || '';
  const [feed, setFeed] = useState<Feed>({ items: [], unreadCount: 0, nextCursor: null });
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const bell = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  const storageKey = `facilita-notification-popup:${userId}`;

  const refresh = useCallback(async () => {
    try {
      const response = await api.get<Feed>('/student-notifications');
      if (!mounted.current) return;
      setFeed(response.data); setError('');
      const unread = response.data.items.filter(item => !item.readAt);
      let shown: string[] = [];
      try { const saved: unknown = JSON.parse(sessionStorage.getItem(storageKey) || '[]'); shown = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []; } catch { /* Session storage can be unavailable. */ }
      const newItems = unread.filter(item => !shown.includes(item.id));
      if (newItems.length) {
        setFresh(newItems.length); setOpen(true);
        try { sessionStorage.setItem(storageKey, JSON.stringify([...new Set([...shown, ...newItems.map(item => item.id)])].slice(-200))); } catch { /* Keep the alert visible without storage. */ }
      }
    } catch { if (mounted.current) setError('Não foi possível atualizar as notificações.'); }
  }, [storageKey]);

  async function loadMore() {
    if (!feed.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await api.get<Feed>(`/student-notifications?cursor=${encodeURIComponent(feed.nextCursor)}`);
      setFeed(current => ({ items: [...current.items, ...response.data.items.filter(item => !current.items.some(old => old.id === item.id))], unreadCount: response.data.unreadCount, nextCursor: response.data.nextCursor }));
    } catch { setError('Não foi possível carregar mais notificações.'); }
    finally { setLoadingMore(false); }
  }

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60000);
    const onFocus = () => { void refresh(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onVisibility);
    return () => { mounted.current = false; window.clearInterval(interval); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisibility); };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); bell.current?.focus(); } };
    document.addEventListener('pointerdown', onPointer); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);

  async function markOne(item: Notification) {
    if (busy) return;
    setBusy(true);
    try {
      if (!item.readAt) await api.patch(`/student-notifications/${encodeURIComponent(item.id)}/read`);
      if (item.kind === 'course') await refreshUser();
      onNavigate(safeView(item.targetView)); setOpen(false); setFresh(0);
      await refresh();
    } catch { setError('Não foi possível abrir esta notificação. Tente novamente.'); }
    finally { setBusy(false); }
  }
  async function markAll() {
    if (busy) return;
    setBusy(true);
    try { await api.post('/student-notifications/read-all'); setFresh(0); await refresh(); }
    catch { setError('Não foi possível marcar todas como lidas.'); }
    finally { setBusy(false); }
  }

  return <div className="student-notifications" ref={root}>
    <span className="student-notifications-sr" role="status" aria-live="polite">{fresh > 0 ? `${fresh} ${fresh === 1 ? 'nova notificação' : 'novas notificações'}. Abra o botão Notificações para conferir.` : ''}</span>
    <button ref={bell} className="student-notifications-bell" aria-label={`Notificações${feed.unreadCount ? `, ${feed.unreadCount} não lidas` : ''}`} aria-expanded={open} aria-controls="student-notifications-panel" onClick={() => { setOpen(value => !value); setFresh(0); }}><Bell size={20} aria-hidden="true" />{feed.unreadCount > 0 && <span className="student-notifications-badge">{feed.unreadCount > 99 ? '99+' : feed.unreadCount}</span>}</button>
    {open && <section id="student-notifications-panel" className="student-notifications-panel" aria-label="Notificações do aluno"><header><div><span className="student-notifications-eyebrow">SEU ESPAÇO</span><h2>{fresh ? `${fresh} ${fresh === 1 ? 'novidade para você' : 'novidades para você'}` : 'Notificações'}</h2></div><button className="student-notifications-close" onClick={() => { setOpen(false); bell.current?.focus(); }} aria-label="Fechar notificações"><X size={18} /></button></header><div className="student-notifications-toolbar"><span>{feed.unreadCount ? `${feed.unreadCount} não ${feed.unreadCount === 1 ? 'lida' : 'lidas'}` : 'Tudo em dia'}</span>{feed.unreadCount > 0 && <button onClick={() => void markAll()} disabled={busy}><CheckCheck size={15} aria-hidden="true" /> Marcar todas como lidas</button>}</div>{error && <div className="student-notifications-error" role="alert">{error} <button onClick={() => void refresh()}>Tentar novamente</button></div>}<div className="student-notifications-list">{feed.items.length ? feed.items.map(item => { const Icon = icon[item.kind] || Bell; return <button key={item.id} className={`student-notifications-item${item.readAt ? '' : ' unread'}`} disabled={busy} onClick={() => void markOne(item)}><span className="student-notifications-icon"><Icon size={18} aria-hidden="true" /></span><span className="student-notifications-copy"><span className="student-notifications-meta">{label[item.kind] || 'Atualização'} · {new Date(item.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span><strong>{item.title}</strong><span>{item.body}</span></span>{!item.readAt && <span className="student-notifications-dot" aria-label="Não lida" />}</button>; }) : <div className="student-notifications-empty"><Bell size={25} aria-hidden="true" /><strong>Nenhuma notificação ainda</strong><p>Novos cursos, avisos e provas aparecerão aqui.</p></div>}{feed.nextCursor && <button className="student-notifications-more" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Carregando…" : "Carregar mais notificações"}</button>}</div></section>}
  </div>;
};
