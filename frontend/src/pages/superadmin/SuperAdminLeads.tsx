import React, { useEffect, useRef, useState } from 'react';
import { Mail, Phone, RefreshCw, Search, X } from 'lucide-react';
import api from '../../api/client';
import { TopBar } from '../../components/TopBar';
import './SuperAdminLeads.css';

const stages = [
  { id: 'NOVO', label: 'Novos', color: '#2f7dd1' },
  { id: 'CONTATO', label: 'Em contato', color: '#a4770c' },
  { id: 'PROPOSTA', label: 'Proposta enviada', color: '#7754ad' },
  { id: 'GANHO', label: 'Convertidos', color: '#1d8656' },
  { id: 'PERDIDO', label: 'Não avançaram', color: '#a15e60' }
] as const;
type Stage = typeof stages[number]['id'];
type Lead = { id: string; nome: string; instituicao: string; email: string; telefone: string; alunos: number | null; mensagem: string; stage: Stage; notas: string; createdAt: string; updatedAt: string };
const date = (value: string) => new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export const SuperAdminLeads: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState('');
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Lead | null>(null);
  const [draft, setDraft] = useState({ stage: 'NOVO' as Stage, notas: '' });
  const load = async (query: string, cursor?: string) => {
    const version = ++requestVersion.current;
    setLoading(true); setNotice(null);
    try { const { data } = await api.get('/leads', { params: { q: query.trim(), cursor } }); if (version !== requestVersion.current) return; setLeads(current => cursor ? [...current, ...data.items.filter((item: Lead) => !current.some(existing => existing.id === item.id))] : data.items); setTotal(data.total); setNextCursor(data.nextCursor); setLoaded(true); }
    catch { if (version === requestVersion.current) setNotice({ error: true, text: 'Não foi possível carregar os leads. Tente atualizar novamente.' }); }
    finally { if (version === requestVersion.current) setLoading(false); }
  };
  useEffect(() => { requestVersion.current++; const timer = window.setTimeout(() => { void load(search); }, 300); return () => { window.clearTimeout(timer); requestVersion.current++; }; }, [search]);
  const update = async (lead: Lead, changes: { stage: Stage; notas?: string }) => {
    if (saving) return;
    setSaving(lead.id); setNotice(null);
    try {
      const { data } = await api.patch<Lead>(`/leads/${lead.id}`, { ...changes, expectedUpdatedAt: lead.updatedAt });
      setLeads(current => current.map(item => item.id === data.id ? data : item));
      setSelected(null);
      setNotice({ error: false, text: 'Lead atualizado e salvo.' });
    } catch (error: any) { setNotice({ error: true, text: error.response?.data?.error || 'Não foi possível salvar. As alterações não foram aplicadas; tente novamente.' }); }
    finally { setSaving(''); }
  };
  const open = (lead: Lead) => { setSelected(lead); setDraft({ stage: lead.stage, notas: lead.notas }); setNotice(null); };
  const filtered = leads;
  return <><TopBar currentPage="Leads e contatos" /><div className="sa-leads">
    <header className="leads-heading"><div><p className="eyebrow">RELACIONAMENTO COM INSTITUIÇÕES</p><h1>Da primeira conversa ao próximo passo.</h1><p className="muted">Contatos recebidos pelo site, organizados por etapa.</p></div><button className="ghost" disabled={loading || !!saving || !!selected} onClick={() => void load(search)}><RefreshCw size={16} /> {loading ? 'Carregando…' : 'Atualizar'}</button></header>
    {notice && <div className={notice.error ? 'inline-form-error' : 'leads-success'} role={notice.error ? 'alert' : 'status'}>{notice.text}</div>}
    {selected && <form className="lead-details" onSubmit={event => { event.preventDefault(); void update(selected, draft); }}>
      <div className="lead-details-title"><div><p className="eyebrow">GERENCIAR CONTATO</p><h2>{selected.instituicao}</h2><p>{selected.nome} · Recebido em {date(selected.createdAt)}</p></div><button type="button" className="ghost" disabled={!!saving} onClick={() => setSelected(null)} aria-label="Fechar detalhes e descartar alterações não salvas"><X size={20} /></button></div>
      <div className="lead-details-contact"><a href={`mailto:${selected.email}`}><Mail size={15} /> {selected.email}</a><a href={`tel:${selected.telefone.replace(/[^+0-9]/g, '')}`}><Phone size={15} /> {selected.telefone}</a><span>{selected.alunos ? selected.alunos.toLocaleString('pt-BR') + ' alunos informados' : 'Quantidade de alunos não informada'}</span></div>
      {selected.mensagem && <blockquote>{selected.mensagem}</blockquote>}
      <fieldset disabled={!!saving}><label>Etapa do contato<select value={draft.stage} onChange={e => setDraft({ ...draft, stage: e.target.value as Stage })}>{stages.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label><label>Observações internas<textarea rows={4} maxLength={5000} value={draft.notas} placeholder="Registre o histórico da conversa e os próximos passos." onChange={e => setDraft({ ...draft, notas: e.target.value })} /><small>{draft.notas.length}/5.000 caracteres · visível somente ao superadmin</small></label><button className="primary">{saving ? 'Salvando…' : 'Salvar contato'}</button></fieldset>
    </form>}
    <div className="leads-toolbar"><span>{loaded ? `${total} contatos${search ? ' encontrados' : ' recebidos'} · ${filtered.length} exibidos` : 'Aguardando contatos…'}</span><label><Search size={17} /><input maxLength={200} disabled={!!selected} aria-label="Buscar leads" placeholder="Buscar instituição, pessoa ou contato" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
    {nextCursor && <p className="muted">Há mais contatos nesta busca. Use “Carregar mais” abaixo do quadro.</p>}
    {loading && !loaded ? <p role="status">Carregando seu quadro de contatos…</p> : loaded && <><p className="leads-help">Arraste um card para mudar de etapa ou use o seletor no próprio card. Abra os detalhes para adicionar observações.</p><div className="leads-board">{stages.map(stage => {
      const items = filtered.filter(lead => lead.stage === stage.id);
      return <section key={stage.id} className="lead-column" aria-label={stage.label} style={{ borderTopColor: stage.color }} onDragOver={event => { if (!saving && !selected) event.preventDefault(); }} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); const lead = leads.find(item => item.id === id); if (lead && lead.stage !== stage.id && !saving && !selected) void update(lead, { stage: stage.id }); }}>
        <header><h2>{stage.label}</h2><span>{items.length}</span></header>
        {items.length ? items.map(lead => <article key={lead.id} className="lead-card" draggable={!saving && !selected} onDragStart={event => { event.dataTransfer.setData('text/plain', lead.id); event.dataTransfer.effectAllowed = 'move'; }}>
          <small className="lead-source">SITE · {new Date(lead.createdAt).toLocaleDateString('pt-BR')}</small><button className="lead-card-title" onClick={() => open(lead)} disabled={!!saving || !!selected}>{lead.instituicao}</button><p>{lead.nome}</p><small>{lead.email}</small><small>{lead.telefone}</small><div className="lead-card-meta">{lead.alunos ? `${lead.alunos.toLocaleString('pt-BR')} alunos` : 'Alunos não informados'}{lead.notas && <span>Com observações</span>}</div>
          <label className="lead-stage-label">Mover para<select aria-label={`Etapa de ${lead.instituicao}`} value={lead.stage} disabled={!!saving || !!selected} onChange={event => void update(lead, { stage: event.target.value as Stage })}>{stages.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><button className="lead-details-button" disabled={!!saving || !!selected} onClick={() => open(lead)}>Ver detalhes e observações →</button>
        </article>) : <p className="lead-column-empty">{search ? 'Nenhum resultado nesta etapa.' : 'Nenhum contato nesta etapa.'}</p>}
      </section>;
    })}</div>{nextCursor && <button className="ghost" disabled={loading || !!saving || !!selected} onClick={() => void load(search, nextCursor)}>{loading ? 'Carregando…' : 'Carregar mais contatos'}</button>}</>}
  </div></>;
};
