import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, BookOpen, Building2, Check, ChevronRight, GraduationCap, Layers, Menu, Minus, Plus, Sparkles, Users, X } from 'lucide-react';
import { calculatePrice, validPricePoints, PricePoint } from '../pricing.mjs';
import './Landing.css';
import { LeadContactForm } from '../components/LeadContactForm';
import './LandingContact.css';

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const count = (value: number) => value.toLocaleString('pt-BR');
const faqs = [
  ['Como funciona o preço por aluno?', 'A mensalidade depende da quantidade de alunos e das faixas publicadas nesta página. O valor médio por aluno diminui gradualmente com o volume.'],
  ['O que acontece entre os volumes da tabela?', 'O simulador faz um cálculo proporcional entre os totais de referência. Assim, o preço médio por aluno cai aos poucos, e cadastrar mais alunos nunca reduz o total da mensalidade.'],
  ['A instituição pode usar sua própria marca?', 'Sim. O ambiente da instituição tem seu próprio subdomínio e permite personalizar logotipo, imagem ou vídeo de login, textos, cores e ícone do navegador.'],
  ['Quem administra os cursos e os conteúdos?', 'A coordenação administra a unidade, cria cursos e vincula professores. Os professores cadastram matérias e videoaulas no curso ao qual estão associados. A equipe também pode cadastrar alunos.'],
  ['A simulação já contrata o serviço?', 'Não. O simulador apresenta uma estimativa mensal pela quantidade informada. Nenhuma cobrança ou contratação acontece ao fazer a simulação.']
];

export const Landing: React.FC = () => {
  const [students, setStudents] = useState('100');
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [pricingStatus, setPricingStatus] = useState('loading');
  const [pricingAttempt, setPricingAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setPricingStatus('loading');
    fetch('/api/public/pricing', { signal: controller.signal, cache: 'no-store' }).then(async response => { if (!response.ok) throw new Error('pricing'); return response.json(); }).then(data => { if (!validPricePoints(data.pricePoints)) throw new Error('pricing'); setPoints(data.pricePoints); setPricingStatus('ready'); }).catch(error => { if (error.name !== 'AbortError') { setPoints([]); setPricingStatus('error'); } });
    return () => controller.abort();
  }, [pricingAttempt]);
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const [mobileMenu, setMobileMenu] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [institution, setInstitution] = useState('');
  const [portalError, setPortalError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const portalDialog = useRef<HTMLElement>(null);
  const number = Number(students);
  const valid = /^\d+$/.test(students) && Number.isSafeInteger(number) && number >= 1 && number <= 100000;
  const price = valid && pricingStatus === 'ready' ? calculatePrice(number, points) : null;
  useEffect(() => { document.title = 'Facilita Estudos | Sua instituição, seu próximo capítulo'; }, []);
  useEffect(() => {
    if (!portalOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPortalOpen(false);
      if (event.key !== 'Tab') return;
      const nodes = portalDialog.current?.querySelectorAll<HTMLElement>('button,input,a[href]');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', close); return () => { document.removeEventListener('keydown', close); previous?.focus(); };
  }, [portalOpen]);
  const setAmount = (value: number) => { setStudents(String(Math.max(1, Math.min(100000, value)))); setCopied(false); };
  const copySimulation = async () => {
    if (!price) return;
    setCopyError(false);
    try { await navigator.clipboard.writeText(`Simulação Facilita Estudos\n${count(number)} alunos\nValor médio: ${brl(price.unitPrice)}/aluno por mês\nMensalidade estimada: ${brl(price.total)}\nEstimativa sem contratação automática.`); setCopied(true); }
    catch { setCopied(false); setCopyError(true); }
  };
  const openInstitution = (event: React.FormEvent) => {
    event.preventDefault();
    const slug = institution.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(slug) || ['app', 'www', 'api', 'mail', 'admin'].includes(slug)) { setPortalError('Informe o identificador da sua instituição, como unigoias.'); return; }
    window.location.assign(`https://${slug}.facilitaestudos.com.br`);
  };
  return <div className="fl-page">
    <a href="#conteudo" className="fl-skip">Pular para o conteúdo</a>
    <header className="fl-header"><a href="#" className="fl-brand" aria-label="Facilita Estudos — início"><img src="/facilita-estudos-logo.svg" alt="Facilita Estudos" /></a><nav aria-label="Navegação principal" className={mobileMenu ? 'fl-nav is-open' : 'fl-nav'}><a href="#plataforma" onClick={() => setMobileMenu(false)}>A plataforma</a><a href="#como-funciona" onClick={() => setMobileMenu(false)}>Como funciona</a><a href="#precos" onClick={() => setMobileMenu(false)}>Preços</a><a href="#duvidas" onClick={() => setMobileMenu(false)}>Dúvidas</a><a href="#contato" onClick={() => setMobileMenu(false)}>Fale com a gente</a></nav><button className="fl-portal" onClick={() => setPortalOpen(true)}>Acessar instituição <ArrowRight size={16} /></button><button className="fl-mobile-toggle" aria-label={mobileMenu ? 'Fechar menu' : 'Abrir menu'} aria-expanded={mobileMenu} onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X /> : <Menu />}</button></header>
    <main id="conteudo">
      <section className="fl-hero fl-container"><div className="fl-hero-copy"><div className="fl-eyebrow"><span /> ENSINO QUE APROXIMA</div><h1>O próximo capítulo da sua <em>instituição.</em></h1><p>Cursos, professores e alunos no mesmo lugar. Um ambiente de aprendizagem com a sua marca, feito para acompanhar cada nova turma.</p><div className="fl-hero-actions"><a className="fl-button" href="#precos">Simular minha instituição <ArrowRight size={18} /></a><a className="fl-text-link" href="#plataforma">Conhecer a plataforma <ArrowDown size={16} /></a></div><div className="fl-hero-note"><span className="fl-note-icon"><GraduationCap size={21} /></span><span>Seu ensino. Sua identidade.<br /><b>Uma plataforma para crescer junto.</b></span></div></div><div className="fl-hero-visual"><img className="fl-student-photo" src="https://images.unsplash.com/photo-1571260899304-425eee4c7efc?auto=format&fit=crop&w=1100&q=85" alt="Estudantes aprendendo juntos em um ambiente acadêmico" /><div className="fl-photo-shade" /><div className="fl-visual-top"><span><BookOpen size={17} /> UM ESPAÇO PARA APRENDER</span><Sparkles size={24} /></div><div className="fl-photo-caption"><span>Da primeira aula<br />ao próximo passo.</span><div className="fl-circle-arrow"><ArrowRight size={30} /></div></div><div className="fl-brand-tag"><Building2 size={19} /><span>Sua instituição<br /><b>com a sua cara.</b></span><Check size={18} /></div></div></section>
      <section className="fl-statement"><div className="fl-container"><span>PARA QUEM ENSINA.<br />PARA QUEM APRENDE.</span><p>Menos caminhos separados.<br /><b>Mais conexão em cada etapa.</b></p><a href="#como-funciona" aria-label="Ver como funciona"><ArrowDown size={25} /></a></div></section>
      <section id="plataforma" className="fl-section fl-container"><div className="fl-section-head"><div><span className="fl-eyebrow">UM CAMPUS DIGITAL, DO SEU JEITO</span><h2>Organize o ensino.<br /><em>Abra possibilidades.</em></h2></div><p>Uma estrutura simples para a instituição organizar a operação e para a equipe transformar conhecimento em conteúdo.</p></div><div className="fl-features">{[
        { icon: <Building2 />, n: '01', title: 'A sua marca na entrada', text: 'Subdomínio próprio, logo, cores e textos personalizados. Da tela de login à navegação.' },
        { icon: <Layers />, n: '02', title: 'Um lugar para os cursos', text: 'Organize cursos e matérias em um ambiente da instituição, com pessoas vinculadas a cada curso.' },
        { icon: <BookOpen />, n: '03', title: 'Conhecimento em movimento', text: 'Dê espaço aos professores para cadastrar matérias e publicar videoaulas para seus alunos.' },
        { icon: <Users />, n: '04', title: 'Equipe e alunos conectados', text: 'Cadastre alunos, vincule professores e mantenha os acessos organizados por instituição e curso.' }
      ].map(feature => <article key={feature.n}><div className="fl-feature-top">{feature.icon}<span>{feature.n}</span></div><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div></section>
      <section id="como-funciona" className="fl-journey"><div className="fl-container"><div className="fl-journey-intro"><span className="fl-eyebrow">DO SEU PLANO À PRIMEIRA AULA</span><h2>Começar pode<br />ser <em>simples.</em></h2><p>Uma base para cada instituição. Um papel claro para cada pessoa.</p></div><ol>{[
        ['A instituição ganha seu espaço', 'Configure a identidade e o endereço do ambiente que vai receber sua comunidade.'],
        ['A coordenação organiza o caminho', 'Crie os cursos e vincule os professores que vão construir essa experiência.'],
        ['O conhecimento encontra os alunos', 'Publique matérias e aulas, cadastre os alunos e dê início à aprendizagem.']
      ].map(([title, text], index) => <li key={title}><span className="fl-step-number">0{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div><ChevronRight size={22} /></li>)}</ol></div></section>
      <section id="precos" className="fl-section fl-container"><div className="fl-section-head"><div><span className="fl-eyebrow">CRESCER FAZ PARTE DO PLANO</span><h2>Mais alunos.<br /><em>Menor valor por aluno.</em></h2></div><p>Uma mensalidade que acompanha o tamanho da sua instituição. Consulte as faixas do plano institucional publicadas abaixo.</p></div>{pricingStatus !== 'ready' && <div role={pricingStatus === 'error' ? 'alert' : 'status'} className="fl-input-error">{pricingStatus === 'loading' ? 'Carregando preços atualizados…' : <>Não foi possível consultar os preços. Nenhum valor foi estimado. <button onClick={() => setPricingAttempt(current => current + 1)}>Tentar novamente</button></>}</div>}<div className="fl-pricing"><div className="fl-calculator"><div className="fl-calculator-top"><span className="fl-eyebrow">SIMULADOR DE MENSALIDADE</span><span className="fl-live-dot">Cálculo em tempo real</span></div><label htmlFor="student-count">Quantos alunos vão aprender com você?</label><div className="fl-number-control"><button aria-label="Diminuir quantidade de alunos" disabled={valid && number === 1} onClick={() => setAmount((valid ? number : 1) - 1)}><Minus size={20} /></button><input id="student-count" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={students} aria-describedby="student-count-help" aria-invalid={!valid} onChange={event => { setStudents(event.target.value); setCopied(false); }} /><button aria-label="Aumentar quantidade de alunos" disabled={valid && number === 100000} onClick={() => setAmount((valid ? number : 0) + 1)}><Plus size={20} /></button></div><p id="student-count-help" className={valid ? 'fl-input-help' : 'fl-input-error'}>{valid ? 'Informe de 1 a 100.000 alunos ou arraste o controle abaixo.' : 'Digite uma quantidade inteira entre 1 e 100.000.'}</p><input className="fl-range" type="range" min={1} max={lastPoint?.students || 1} disabled={pricingStatus !== 'ready'} value={Math.min(lastPoint?.students || 1, valid ? number : 1)} aria-label="Quantidade de alunos no simulador" onChange={event => setAmount(Number(event.target.value))} /><div className="fl-range-labels"><span>1 aluno</span><span>{lastPoint ? count(lastPoint.students) + '+ alunos' : '—'}</span></div><div className="fl-presets">{points.map(point => point.students).map(amount => <button key={amount} aria-pressed={number === amount} onClick={() => setAmount(amount)}>{count(amount)} alunos</button>)}</div><div className="fl-price-result" aria-live="polite" aria-atomic="true"><div><span>VALOR MÉDIO POR ALUNO / MÊS</span><strong>{price ? brl(price.unitPrice) : '—'}</strong></div><span className="fl-discount">{price ? `${price.discount.toFixed(0)}% menor que o valor inicial` : 'Aguardando quantidade válida'}</span></div><div className="fl-monthly"><span>Mensalidade estimada<br /><small>{valid ? `${count(number)} alunos` : '—'}</small></span><strong>{price ? brl(price.total) : '—'}<small>/ mês</small></strong></div><button className="fl-button fl-copy" disabled={!price} onClick={() => void copySimulation()}>{copied ? <><Check size={18} /> Simulação copiada</> : <>Copiar minha simulação <ArrowRight size={18} /></>}</button>{copyError && <p role="alert" className="fl-input-error">Não foi possível copiar automaticamente. Selecione os valores acima para copiar.</p>}<p className="fl-price-disclaimer">Estimativa mensal. O simulador não gera cobrança nem contratação. Valores intermediários são calculados proporcionalmente aos totais de referência.</p></div><aside className="fl-pricing-guide"><span className="fl-eyebrow">REFERÊNCIAS DE VOLUME</span><h3>Do primeiro grupo<br />à instituição inteira.</h3><table><caption>Valores de referência por quantidade de alunos</caption><thead><tr><th>Alunos</th><th>Por aluno / mês</th></tr></thead><tbody>{points.map(point => <tr key={point.students}><td>{point === firstPoint ? 'Até ' + count(point.students) : point === lastPoint ? count(point.students) + ' ou mais' : count(point.students)}</td><td>{brl(point.unitCents / 100)}</td></tr>)}</tbody></table><div className="fl-floor"><span><Sparkles size={18} /> O seu crescimento conta.</span><p>{lastPoint ? <>A partir de {count(lastPoint.students)} alunos, o valor chega a <b>{brl(lastPoint.unitCents / 100)} por aluno/mês.</b></> : 'Consulte a equipe para conhecer as condições disponíveis.'}</p></div><p className="fl-guide-note">O desconto é gradual. Adicionar alunos aumenta a mensalidade total e reduz o valor médio por aluno até o piso.</p></aside></div></section>
      <LeadContactForm students={valid ? number : undefined} />
      <section id="duvidas" className="fl-faq fl-container"><div><span className="fl-eyebrow">ANTES DO PRÓXIMO PASSO</span><h2>Boas perguntas.<br /><em>Respostas claras.</em></h2></div><div className="fl-faq-list">{faqs.map(([title, answer]) => <details key={title}><summary>{title}<Plus size={19} /></summary><p>{answer}</p></details>)}</div></section>
      <section className="fl-last-call fl-container"><div><span className="fl-eyebrow">O PRÓXIMO CAPÍTULO COMEÇA AQUI</span><h2>Seu ensino tem muito<br />para <em>ir além.</em></h2></div><a className="fl-button" href="#contato">Conversar com a equipe <ArrowRight size={18} /></a></section>
    </main><footer className="fl-footer fl-container"><a className="fl-brand" href="#"><img src="/facilita-estudos-logo.svg" alt="Facilita Estudos" /></a><span>Aprender aproxima. Facilitar transforma.</span><a href="https://app.facilitaestudos.com.br">Área administrativa <ArrowRight size={14} /></a><small>© {new Date().getFullYear()} Facilita Estudos</small></footer>
    {portalOpen && <div className="fl-modal-backdrop"><section ref={portalDialog} role="dialog" aria-modal="true" aria-labelledby="portal-title" className="fl-portal-dialog"><button className="fl-modal-close" aria-label="Fechar acesso à instituição" onClick={() => setPortalOpen(false)}><X size={22} /></button><span className="fl-eyebrow">BEM-VINDO DE VOLTA</span><h2 id="portal-title">Qual é sua instituição?</h2><p>Use o identificador fornecido pela sua coordenação para abrir o portal.</p><form onSubmit={openInstitution}><label htmlFor="institution-domain">Identificador da instituição</label><input id="institution-domain" autoFocus required value={institution} placeholder="Ex.: unigoias" onChange={event => { setInstitution(event.target.value); setPortalError(''); }} /><small>{institution.trim().toLowerCase() || 'sua-instituicao'}.facilitaestudos.com.br</small>{portalError && <p role="alert" className="fl-input-error">{portalError}</p>}<button type="submit" className="fl-button">Acessar instituição <ArrowRight size={17} /></button></form></section></div>}
  </div>;
};
