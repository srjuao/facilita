import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, CirclePlus, Eye, EyeOff, Grip, Palette, Save, Sparkles, Trash2 } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { TopBar } from '../../components/TopBar';
import './study-map.css';

type Node = { id: string; title: string; description: string; parentId: string | null; x: number; y: number; color: string };
type MapData = { title: string; description: string; nodes: Node[]; theme: 'classic' | 'playful'; backgroundColor: string; cardShape: 'rounded' | 'soft' | 'square'; connectorStyle: 'solid' | 'dashed'; published: boolean; version: number };
type Course = { id: string; nome: string };
const failure = (error: unknown) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Não foi possível concluir esta ação.';
const createsCycle = (candidate: string, target: string, nodes: Node[]) => { const lookup = new Map(nodes.map(node => [node.id, node])); let node = lookup.get(candidate); while (node?.parentId) { if (node.parentId === target) return true; node = lookup.get(node.parentId); } return false; };

export const StudentStudyPlan: React.FC = () => {
  const { user } = useAuth();
  const coordinator = user?.role === 'coord';
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState(user?.courseId || '');
  const [map, setMap] = useState<MapData | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; clientX: number; clientY: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => { if (!coordinator) return; let alive = true; api.get<Course[]>('/coord/courses').then(({ data }) => { if (alive) { setCourses(data); setCourseId(current => current || data[0]?.id || ''); } }).catch(issue => { if (alive) setError(failure(issue)); }); return () => { alive = false; }; }, [coordinator]);
  useEffect(() => { if (!courseId) { setLoading(false); return; } let alive = true; setLoading(true); setError(''); api.get<{ course: Course; map: MapData | null; canEdit: boolean }>(`/study-maps/courses/${encodeURIComponent(courseId)}`).then(({ data }) => { if (!alive) return; setCanEdit(data.canEdit); setMap(data.map || (data.canEdit ? { title: `Trilha de ${data.course.nome}`, description: '', nodes: [], theme: 'classic', backgroundColor: '#fbfcfe', cardShape: 'rounded', connectorStyle: 'solid', published: false, version: 0 } : null)); setSelectedId(null); setDirty(false); }).catch(issue => { if (alive) setError(failure(issue)); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, [courseId, reload]);
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const measure = () => setViewport({ width: element.clientWidth, height: element.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [map?.nodes.length]);

  const change = (patch: Partial<MapData>) => { setMap(current => current ? { ...current, ...patch } : current); setDirty(true); setMessage(''); };
  const applyTheme = (theme: MapData['theme']) => change(theme === 'playful'
    ? { theme, backgroundColor: '#fff5e7', cardShape: 'soft', connectorStyle: 'dashed' }
    : { theme, backgroundColor: '#fbfcfe', cardShape: 'rounded', connectorStyle: 'solid' });
  const selected = map?.nodes.find(node => node.id === selectedId);
  const changeNode = (patch: Partial<Node>) => { if (map && selected) change({ nodes: map.nodes.map(node => node.id === selected.id ? { ...node, ...patch } : node) }); };
  const addNode = () => { if (!map) return; const siblings = map.nodes.filter(node => node.parentId === (selected?.id || null)).length; const id = `topic_${crypto.randomUUID().replace(/-/g, '')}`; change({ nodes: [...map.nodes, { id, title: 'Novo tópico', description: '', parentId: selected?.id || null, x: selected ? Math.min(2100, selected.x + 310) : 70 + (siblings % 3) * 300, y: selected ? Math.min(1650, Math.max(20, selected.y + (siblings % 2 ? 160 : -160))) : 100 + Math.floor(siblings / 3) * 180, color: '#2f7dd1' }] }); setSelectedId(id); };
  const removeNode = () => { if (!map || !selected) return; change({ nodes: map.nodes.filter(node => node.id !== selected.id).map(node => node.parentId === selected.id ? { ...node, parentId: selected.parentId } : node) }); setSelectedId(null); };
  const save = async () => { if (!map || !courseId || saving) return; setSaving(true); setError(''); try { const { data } = await api.put<MapData>(`/study-maps/courses/${encodeURIComponent(courseId)}`, map); setMap(data); setDirty(false); setMessage(data.published ? 'Mapa publicado para os alunos.' : 'Rascunho salvo. Alunos ainda não podem vê-lo.'); } catch (issue) { setError(failure(issue)); } finally { setSaving(false); } };
  const width = Math.max(280, ...(map?.nodes || []).map(node => node.x + 250));
  const height = Math.max(180, ...(map?.nodes || []).map(node => node.y + 135));
  const scale = viewport.width && viewport.height ? Math.min(1.45, (viewport.width - 40) / width, (viewport.height - 40) / height) : 1;
  const left = Math.max(20, (viewport.width - width * scale) / 2);
  const top = Math.max(20, (viewport.height - height * scale) / 2);
  const positions = map?.nodes || [];
  const minX = Math.min(...positions.map(node => node.x));
  const maxX = Math.max(...positions.map(node => node.x));
  const minY = Math.min(...positions.map(node => node.y));
  const maxY = Math.max(...positions.map(node => node.y));
  const displayX = (node: Node) => canEdit || !viewport.width ? node.x : minX === maxX ? (viewport.width - 230) / 2 : 24 + (node.x - minX) / (maxX - minX) * Math.max(0, viewport.width - 278);
  const displayY = (node: Node) => canEdit || !viewport.height ? node.y : minY === maxY ? (viewport.height - 110) / 2 : 24 + (node.y - minY) / (maxY - minY) * Math.max(0, viewport.height - 158);
  const canvasWidth = canEdit || !viewport.width ? width : viewport.width;
  const canvasHeight = canEdit || !viewport.height ? height : viewport.height;

  return <div className="study-screen"><TopBar currentPage="Plano de estudos" /><section className="study-page">
    <header className="study-heading"><div><span className="study-eyebrow">TRILHA DE APRENDIZAGEM</span><h1>Plano de estudos</h1><p>{canEdit ? 'Organize a jornada do curso e publique quando estiver pronta.' : 'Explore o mapa criado pela sua instituição.'}</p></div>{canEdit && map && <div className="study-actions"><span className="study-status">{map.published ? <Eye size={15} /> : <EyeOff size={15} />}{map.published ? 'Publicado' : 'Rascunho'}</span><button type="button" onClick={save} disabled={!dirty || saving}><Save size={16} />{saving ? 'Salvando…' : 'Salvar mapa'}</button></div>}</header>
    {coordinator && <label className="study-course">Curso<select value={courseId} onChange={event => { if (dirty && !window.confirm('Descartar alterações não salvas?')) return; setCourseId(event.target.value); }}><option value="">Selecione um curso</option>{courses.map(course => <option key={course.id} value={course.id}>{course.nome}</option>)}</select></label>}
    {error && <p role="alert" className="study-message error">{error} <button type="button" onClick={() => setReload(value => value + 1)}>Atualizar</button></p>}{message && <p role="status" className="study-message">{message}</p>}
    {!courseId && !loading ? <div className="study-empty"><BookOpen /><h2>Nenhum curso selecionado</h2><p>{coordinator ? 'Cadastre ou selecione um curso para começar.' : 'Peça à coordenação para vincular sua conta a um curso.'}</p></div> : loading ? <p role="status">Carregando mapa…</p> : !map ? <div className="study-empty"><BookOpen /><h2>Mapa ainda não publicado</h2><p>A coordenação e os professores estão preparando sua trilha.</p></div> : <div className="study-layout"><div className={`study-main study-theme-${map.theme} study-shape-${map.cardShape}`}><div className="study-intro"><div><span>{map.theme === 'playful' ? 'NOSSA AVENTURA' : 'MAPA DO CURSO'}</span>{canEdit ? <input aria-label="Título do mapa" maxLength={120} value={map.title} onChange={event => change({ title: event.target.value })} /> : <h2>{map.title}</h2>}{canEdit ? <textarea aria-label="Descrição do mapa" maxLength={1000} rows={2} placeholder="Explique o objetivo da trilha…" value={map.description} onChange={event => change({ description: event.target.value })} /> : map.description && <p>{map.description}</p>}</div><small>{map.nodes.length} {map.nodes.length === 1 ? 'tópico' : 'tópicos'}</small></div>
      {canEdit && <div className="study-toolbar"><button type="button" onClick={addNode}><CirclePlus size={17} />{selected ? 'Criar ramificação' : 'Adicionar tópico'}</button><span><Grip size={14} />Arraste para organizar</span><details className="study-appearance"><summary><Palette size={16} /> Aparência</summary><div className="study-appearance-panel"><strong>Estilo do plano</strong><div className="study-theme-options"><button type="button" aria-pressed={map.theme === 'classic'} onClick={() => applyTheme('classic')}>Clássico</button><button type="button" aria-pressed={map.theme === 'playful'} onClick={() => applyTheme('playful')}><Sparkles size={15} /> Lúdico</button></div><label>Cor do fundo<input type="color" value={map.backgroundColor} onChange={event => change({ backgroundColor: event.target.value })} /></label><label>Formato dos cartões<select value={map.cardShape} onChange={event => change({ cardShape: event.target.value as MapData['cardShape'] })}><option value="rounded">Arredondado</option><option value="soft">Orgânico</option><option value="square">Discreto</option></select></label><label>Conexões<select value={map.connectorStyle} onChange={event => change({ connectorStyle: event.target.value as MapData['connectorStyle'] })}><option value="solid">Contínuas</option><option value="dashed">Pontilhadas</option></select></label><small>As mudanças aparecem agora; salve para publicar.</small></div></details></div>}
      {map.nodes.length ? <><div ref={viewportRef} className="study-scroll" style={{ '--study-map-bg': map.backgroundColor } as React.CSSProperties} aria-label="Mapa mental do curso">
        <div className="study-canvas" style={{ width: canvasWidth, height: canvasHeight, left: canEdit ? left : 0, top: canEdit ? top : 0, transform: canEdit ? `scale(${scale})` : undefined }}
          onPointerMove={event => {
            if (!drag) return;
            change({ nodes: map.nodes.map(node => node.id === drag.id ? {
              ...node,
              x: Math.max(0, Math.min(2400, drag.x + (event.clientX - drag.clientX) / scale)),
              y: Math.max(0, Math.min(1800, drag.y + (event.clientY - drag.clientY) / scale))
            } : node) });
          }} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
          <svg className="study-lines" width={canvasWidth} height={canvasHeight} aria-hidden="true">
            {map.nodes.map(node => { const parent = map.nodes.find(item => item.id === node.parentId); return parent ? <path key={node.id} d={`M${displayX(parent) + 230} ${displayY(parent) + 55} C${displayX(parent) + 275} ${displayY(parent) + 55}, ${displayX(node) - 45} ${displayY(node) + 55}, ${displayX(node)} ${displayY(node) + 55}`} fill="none" stroke={map.theme === 'playful' ? node.color : '#aebbd0'} strokeWidth={map.theme === 'playful' ? 3 : 2} strokeDasharray={map.connectorStyle === 'dashed' ? '8 9' : undefined} strokeLinecap="round" opacity={map.theme === 'playful' ? .75 : 1} /> : null; })}
          </svg>
          {map.nodes.map((node, index) => <button type="button" key={node.id} className={`study-node ${selectedId === node.id ? 'selected' : ''}`} style={{ left: displayX(node), top: displayY(node), '--node-color': node.color } as React.CSSProperties} onClick={() => setSelectedId(node.id)} onPointerDown={event => { if (!canEdit || event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); setDrag({ id: node.id, x: node.x, y: node.y, clientX: event.clientX, clientY: event.clientY }); }}><small>{String(index + 1).padStart(2, '0')}</small><strong>{node.title}</strong><span>{node.description || (canEdit ? 'Clique para detalhar' : 'Ver detalhes')}</span><ArrowRight size={16} /></button>)}
        </div>
      </div><div className="study-mobile-list" style={{ backgroundColor: map.backgroundColor }} aria-label="Tópicos do plano de estudos">
        {map.nodes.map((node, index) => <button type="button" key={node.id} className={selectedId === node.id ? 'selected' : ''} style={{ '--node-color': node.color, '--node-depth': node.parentId ? '1' : '0' } as React.CSSProperties} onClick={() => setSelectedId(node.id)}><small>{String(index + 1).padStart(2, '0')}</small><strong>{node.title}</strong><ArrowRight size={16} /></button>)}
      </div></> : <div className="study-empty"><CirclePlus /><h2>{canEdit ? 'Comece pelo primeiro tópico' : 'Ainda não há tópicos nesta trilha'}</h2><p>{canEdit ? 'Crie o tema central e adicione ramificações.' : 'A instituição adicionará os tópicos em breve.'}</p>{canEdit && <button type="button" onClick={addNode}>Criar primeiro tópico <ArrowRight size={16} /></button>}</div>}</div>
      {selected ? <aside className="study-detail"><span>{canEdit ? 'EDITAR TÓPICO' : 'SOBRE O TÓPICO'}</span>{canEdit ? <><label>Título<input maxLength={100} value={selected.title} onChange={event => changeNode({ title: event.target.value })} /></label><label>Descrição<textarea rows={5} maxLength={500} value={selected.description} onChange={event => changeNode({ description: event.target.value })} placeholder="O que o aluno vai estudar?" /></label><label>Conectar a<select value={selected.parentId || ''} onChange={event => changeNode({ parentId: event.target.value || null })}><option value="">Tema central</option>{map.nodes.filter(node => node.id !== selected.id && !createsCycle(node.id, selected.id, map.nodes)).map(node => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label><label>Cor do tópico<input type="color" value={selected.color} onChange={event => changeNode({ color: event.target.value })} /></label><button className="study-remove" type="button" onClick={removeNode}><Trash2 size={16} /> Remover tópico</button></> : <><h2>{selected.title}</h2><p>{selected.description || 'Acompanhe este tópico na sua jornada.'}</p></>}</aside> : canEdit && <aside className="study-detail"><span>PUBLICAÇÃO</span><h2>Monte a jornada</h2><p>Selecione um cartão para editar. Crie ramificações e arraste os cartões para organizar o mapa.</p><label className="study-publish"><input type="checkbox" checked={map.published} onChange={event => change({ published: event.target.checked })} />Publicar para os alunos</label><small>Salve para aplicar a mudança.</small></aside>}
      {canEdit && selected && <label className="study-publish study-publish-bottom"><input type="checkbox" checked={map.published} disabled={!map.nodes.length} onChange={event => change({ published: event.target.checked })} />Publicar para os alunos</label>}
    </div>}
  </section></div>;
};
