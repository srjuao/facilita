import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, CheckCircle2, ExternalLink, Plus, Power, RotateCcw, ShieldCheck, UsersRound, X } from 'lucide-react';
import { TopBar } from '../../components/TopBar';
import api from '../../api/client';
import { Tenant } from '../../types';
import { InstitutionCreateWizard } from './InstitutionCreateWizard';

type TenantUser = { id: string; nome: string; email: string; papel: string; role: string };
const blankFaculty = { nome: '', full: '', cidade: '', subdomain: '', admin: '', adminEmail: '', adminPassword: '' };
const blankUser = { nome: '', email: '', role: 'coord', password: '' };

export const SuperAdminTenants: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [faculty, setFaculty] = useState(blankFaculty);
  const [person, setPerson] = useState(blankUser);
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [branding, setBranding] = useState({ logoUrl: '', loginImageUrl: '', faviconUrl: '', browserTitle: '', primaryColor: '#2f7dd1' });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [personError, setPersonError] = useState('');
  const [tenantTab, setTenantTab] = useState<'active' | 'inactive'>('active');
  const selectedId = useRef<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setTenants((await api.get('/tenants')).data); }
    catch { setNotice({ kind: 'error', text: 'Não foi possível carregar as faculdades.' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const suggestedDomain = useMemo(() => {
    const slug = faculty.subdomain.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${slug || 'sua-faculdade'}.facilitaestudos.com.br`;
  }, [faculty.subdomain]);

  const openFaculty = async (tenant: Tenant) => {
    selectedId.current = tenant.id; setSelected(tenant); setUsers([]); setPerson(blankUser); setNotice(null); setPersonError('');
    setBranding({ logoUrl: tenant.logoUrl || '', loginImageUrl: tenant.loginImageUrl || '', faviconUrl: tenant.faviconUrl || '', browserTitle: tenant.browserTitle || '', primaryColor: tenant.primaryColor || '#2f7dd1' });
    try {
      const response = await api.get(`/tenants/${tenant.id}/users`);
      if (selectedId.current === tenant.id) setUsers(response.data);
    }
    catch { setNotice({ kind: 'error', text: 'A faculdade foi selecionada, mas os usuários não puderam ser carregados.' }); }
  };

  const createFaculty = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setNotice(null);
    try {
      const created = (await api.post('/tenants', faculty)).data as Tenant;
      setTenants(current => [...current, created]); setFaculty(blankFaculty); setShowForm(false);
      setNotice({ kind: 'ok', text: `Faculdade criada. O endereço reservado é ${created.dominio}.` });
      await openFaculty(created);
    } catch (error: any) { setNotice({ kind: 'error', text: error.response?.data?.error || 'Não foi possível criar a faculdade.' }); }
    finally { setSaving(false); }
  };

  const linkPerson = async (event: FormEvent) => {
    event.preventDefault(); if (!selected) return;
    setSaving(true); setNotice(null); setPersonError('');
    try {
      const created = (await api.post(`/tenants/${selected.id}/users`, person)).data as TenantUser;
      if (selectedId.current === selected.id) setUsers(current => [...current, created]);
      setNotice({ kind: 'ok', text: `${created.nome} foi vinculado a ${selected.nome}.` });
    } catch (error: any) { const message = error.response?.data?.error || 'Não foi possível vincular o usuário.'; setNotice({ kind: 'error', text: message }); setPersonError(message); }
    finally { setSaving(false); }
  };

  const updateStatus = async (ativo: boolean) => {
    if (!selected) return;
    setSaving(true); setNotice(null);
    try {
      const updated = (await api.patch(`/tenants/${selected.id}/status`, { ativo })).data as Tenant;
      setSelected(updated);
      setTenants(current => current.map(item => item.id === updated.id ? updated : item));
      setNotice({ kind: 'ok', text: ativo ? `${updated.nome} foi reativada.` : `${updated.nome} foi desativada. Os dados foram preservados.` });
    } catch (error: any) { setNotice({ kind: 'error', text: error.response?.data?.error || 'Não foi possível atualizar o status da faculdade.' }); }
    finally { setSaving(false); }
  };

  const saveBranding = async (event: FormEvent) => {
    event.preventDefault(); if (!selected) return;
    setSaving(true); setNotice(null);
    try {
      const updated = (await api.patch(`/tenants/${selected.id}/branding`, branding)).data as Tenant;
      setSelected(updated);
      setTenants(current => current.map(item => item.id === updated.id ? updated : item));
      setNotice({ kind: 'ok', text: `A identidade de ${updated.nome} foi atualizada.` });
    } catch (error: any) { setNotice({ kind: 'error', text: error.response?.data?.error || 'Não foi possível salvar a identidade.' }); }
    finally { setSaving(false); }
  };

  const uploadBrandingAsset = async (assetType: 'logo' | 'favicon' | 'loginMedia', file?: File) => {
    if (!selected || !file) return;
    setSaving(true); setNotice(null);
    try {
      const body = new FormData(); body.append('assetType', assetType); body.append('file', file);
      const response = await api.post(`/tenants/${selected.id}/branding/upload`, body);
      const key = assetType === 'logo' ? 'logoUrl' : assetType === 'favicon' ? 'faviconUrl' : 'loginImageUrl';
      setBranding(current => ({ ...current, [key]: response.data.url }));
      setNotice({ kind: 'ok', text: 'Arquivo enviado. Clique em “Salvar identidade” para publicar.' });
    } catch (error: any) { setNotice({ kind: 'error', text: error.response?.data?.error || 'Não foi possível enviar o arquivo.' }); }
    finally { setSaving(false); }
  };

  const activeCount = tenants.filter(tenant => tenant.ativo).length;
  const visibleTenants = tenants.filter(tenant => tenantTab === 'active' ? tenant.ativo : !tenant.ativo);

  return <div>
    <TopBar currentPage="Central de faculdades" />
    <div style={{ padding: '0 28px 44px', maxWidth: 1440, margin: '0 auto' }}>
      <section style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'end', padding: '20px 0 26px', borderBottom: '1px solid var(--line)' }}>
        <div><p className="eyebrow">OPERAÇÃO DA PLATAFORMA</p><h1 style={{ margin: '5px 0 7px' }}>Faculdades, domínios e acessos.</h1><p className="muted" style={{ margin: 0 }}>Crie uma faculdade, reserve seu endereço e vincule a equipe que vai operar a instituição.</p></div>
        <button className="primary" onClick={() => setShowForm(true)}><Plus size={18} /> Nova faculdade</button>
      </section>
      {notice && <div role="status" style={{ margin: '18px 0', padding: '12px 14px', borderRadius: 10, background: notice.kind === 'ok' ? '#ecfdf3' : '#fef2f2', color: notice.kind === 'ok' ? '#166534' : '#b91c1c' }}>{notice.text}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? 'minmax(0, 1fr) minmax(350px, .75fr)' : '1fr', gap: 24, marginTop: 26 }}>
        <section><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><h2 style={{ fontSize: 16, margin: 0 }}>Instituições cadastradas</h2><span className="pill">{activeCount} ativas · {tenants.length - activeCount} inativas</span></div><div className="tenant-tabs" role="tablist" aria-label="Situação das instituições"><button role="tab" aria-selected={tenantTab === 'active'} className={tenantTab === 'active' ? 'on' : ''} onClick={() => setTenantTab('active')}>Ativas <span>{activeCount}</span></button><button role="tab" aria-selected={tenantTab === 'inactive'} className={tenantTab === 'inactive' ? 'on' : ''} onClick={() => setTenantTab('inactive')}>Desativadas <span>{tenants.length - activeCount}</span></button></div>
          {loading ? <div className="card">Carregando faculdades…</div> : visibleTenants.length === 0 ? <div className="card" style={{ padding: 32, textAlign: 'center' }}><Building2 size={28} /><p>Nenhuma instituição nesta aba.</p></div> : <div style={{ display: 'grid', gap: 12 }}>{visibleTenants.map(tenant => <button key={tenant.id} onClick={() => void openFaculty(tenant)} className="tenant-row" aria-pressed={selected?.id === tenant.id} style={!tenant.ativo ? { opacity: .62 } : undefined}><span className="tenant-mark">{tenant.nome.slice(0, 1)}</span><span style={{ textAlign: 'left', flex: 1 }}><b>{tenant.nome}</b><small>{tenant.cidade} · {tenant.full}</small></span><span className="domain">{tenant.ativo ? <><CheckCircle2 size={14} /> {tenant.dominio}</> : 'Unidade desativada'}</span><span className={`pill ${tenant.ativo ? 'good' : 'warn'}`}>{tenant.ativo ? 'Ativa' : 'Inativa'}</span><span className="pill">{tenant.courses.length} cursos</span></button>)}</div>}
        </section>
        {selected && <aside className="card" style={{ padding: 0, overflow: 'hidden', alignSelf: 'start' }}><div style={{ padding: 20, background: '#102448', color: '#fff' }}><button aria-label="Fechar painel" onClick={() => { selectedId.current = null; setSelected(null); }} className="close"><X size={18} /></button><p className="eyebrow" style={{ color: '#bfdbfe' }}>FACULDADE SELECIONADA</p><h2 style={{ margin: '7px 0 4px' }}>{selected.nome}</h2><a href={`https://${selected.dominio}`} target="_blank" rel="noreferrer" style={{ color: '#bfdbfe', fontSize: 13 }}><ExternalLink size={14} /> {selected.dominio}</a></div><div style={{ padding: 20 }}><div className={`tenant-status ${selected.ativo ? 'active' : 'inactive'}`}><span><ShieldCheck size={16} /> {selected.ativo ? 'Unidade em operação' : 'Unidade desativada'}</span><button className={selected.ativo ? 'danger-action' : 'ghost'} onClick={() => void updateStatus(!selected.ativo)} disabled={saving}>{selected.ativo ? <><Power size={15} /> Desativar unidade</> : <><RotateCcw size={15} /> Reativar unidade</>}</button></div>{!selected.ativo && <p className="muted" style={{ fontSize: 12, margin: '12px 0 18px' }}>O acesso da unidade está bloqueado, mas usuários, cursos e histórico permanecem preservados.</p>}<form className="compact-form identity-form" onSubmit={saveBranding}><h3>Identidade da unidade</h3><p className="muted">Envie o logotipo, ícone e imagem ou vídeo MP4 de entrada. A identidade aparece no subdomínio desta faculdade.</p><label>Logotipo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={event => void uploadBrandingAsset('logo', event.target.files?.[0])} /></label><label>Imagem ou vídeo da tela de login<input type="file" accept="image/png,image/jpeg,image/webp,video/mp4" onChange={event => void uploadBrandingAsset('loginMedia', event.target.files?.[0])} /></label><label>Ícone do navegador<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={event => void uploadBrandingAsset('favicon', event.target.files?.[0])} /></label><label>Título da aba do navegador<input maxLength={80} placeholder={`${selected.nome} | Portal acadêmico`} value={branding.browserTitle} onChange={e => setBranding({ ...branding, browserTitle: e.target.value })} /></label><label>Cor principal<input type="color" value={branding.primaryColor} onChange={e => setBranding({ ...branding, primaryColor: e.target.value })} /></label><button className="btn" disabled={saving}>{saving ? 'Salvando…' : 'Salvar identidade'}</button></form><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}><UsersRound size={17} /><b>Usuários vinculados</b><span className="pill" style={{ marginLeft: 'auto' }}>{users.length}</span></div><div style={{ margin: '12px 0 18px' }}>{users.length ? users.map(item => <div key={item.id} style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}><b style={{ display: 'block', fontSize: 13 }}>{item.nome}</b><small className="muted">{item.email} · {item.papel}</small></div>) : <p className="muted">Ainda não há usuários nesta faculdade.</p>}</div>{selected.ativo && <form className="compact-form" onSubmit={linkPerson}><h3>Vincular pessoa</h3><p className="muted">Para uma nova conta, defina a senha de acesso. Contas existentes serão apenas vinculadas.</p><label>Nome<input required value={person.nome} onChange={e => setPerson({ ...person, nome: e.target.value })} /></label><label>E-mail institucional<input type="email" required value={person.email} onChange={e => setPerson({ ...person, email: e.target.value })} /></label><label>Perfil<select value={person.role} onChange={e => setPerson({ ...person, role: e.target.value })}><option value="coord">Coordenação</option><option value="aluno">Aluno</option></select></label><label>Senha de acesso<input type="password" minLength={8} value={person.password} onChange={e => setPerson({ ...person, password: e.target.value })} /></label>{personError && <div className="inline-form-error" role="alert"><b>Nao foi possivel vincular esta conta.</b><span>{personError} Escolha outro e-mail ou abra a unidade indicada para gerenciar o vinculo.</span></div>}<button className="primary" disabled={saving}>{saving ? 'Salvando…' : 'Vincular usuário'}</button></form>}</div></aside>}
      </div>
      {showForm && <InstitutionCreateWizard onClose={() => setShowForm(false)} onCreated={created => { setTenants(current => [...current, created]); setShowForm(false); setNotice({ kind: 'ok', text: 'Instituição criada. O endereço reservado é ' + created.dominio + '.' }); void openFaculty(created); }} />}
    </div>
  </div>;
};
