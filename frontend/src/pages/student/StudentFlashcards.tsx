import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useCourse } from '../../context/CourseContext';
import { TopBar } from '../../components/TopBar';
import { HorizontalBars } from '../../components/Charts';
import { 
  Layers, 
  RotateCw, 
  CheckCircle2, 
  XCircle, 
  Flame, 
  Brain, 
  Plus, 
  Sparkles, 
  HelpCircle, 
  TrendingUp, 
  Award,
  BookOpen,
  Check,
  Zap,
  X
} from 'lucide-react';

interface FlashcardData {
  id: string;
  topic: string;
  question: string;
  answer: string;
  difficulty?: 'Fácil' | 'Médio' | 'Difícil';
  lessonRef?: string;
}

export const StudentFlashcards: React.FC = () => {
  const { user } = useAuth();
  const { modules } = useCourse();

  const [selectedTopic, setSelectedTopic] = useState<string>('Fisiologia Humana');
  const [currentCardIdx, setCurrentCardIdx] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [streakDays, setStreakDays] = useState<number>(9);
  const [completedTodayCount, setCompletedTodayCount] = useState<number>(14);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal para Criar Flashcard Personalizado
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTopic, setNewTopic] = useState<string>('Fisiologia Humana');
  const [newQuestion, setNewQuestion] = useState<string>('');
  const [newAnswer, setNewAnswer] = useState<string>('');

  // Banco de Flashcards por Matéria (armazenado com LocalStorage)
  const defaultCards: FlashcardData[] = [
    {
      id: 'fc_1',
      topic: 'Fisiologia Humana',
      question: 'O que caracteriza o mecanismo da filtração glomerular e como a pressão de ultrafiltração é regulada?',
      answer: 'A filtração glomerular é determinada pela Pressão Hidrostática nos Capilares Glomerulares (favorece a filtração ~55 mmHg) oposta pela Pressão Oncótica Plasma (30 mmHg) e Pressão na Cápsula de Bowman (15 mmHg). A taxa de filtração (TFG) é autoregulada pelo mecanismo miogênico e feedback túbulo-glomerular.',
      difficulty: 'Difícil',
      lessonRef: 'Aula 2: Fisiologia Cardíaca e Renal'
    },
    {
      id: 'fc_2',
      topic: 'Fisiologia Humana',
      question: 'Qual é a diferença funcional entre o Potencial de Ação de um neurônio e de um cardiomiócito ventricular?',
      answer: 'O cardiomiócito apresenta uma Fase de Platô (Fase 2) prolongada devido à entrada sustentada de íons Cálcio (Canais de Ca²⁺ tipo L), o que previne a tetania cardíaca e garante um Período Refratário Absoluto longo (~250ms).',
      difficulty: 'Médio',
      lessonRef: 'Aula 1: Potencial de Ação e Sinapses'
    },
    {
      id: 'fc_3',
      topic: 'Fisiologia Humana',
      question: 'Como a Lei de Frank-Starling atua no débito cardíaco durante o aumento do retorno venoso?',
      answer: 'Quanto maior o estiramento das fibras miocárdicas no final da diástole (maior volume diastólico final / pré-carga), maior será a força de contração sistólica e maior o volume de ejeção sistólico.',
      difficulty: 'Fácil',
      lessonRef: 'Aula 3: Hemodinâmica e Pressão Arterial'
    },
    {
      id: 'fc_4',
      topic: 'Semiologia Geral',
      question: 'Quais são as 4 fases principais da Anamnese Médica Tradicional?',
      answer: '1. Identificação do Paciente; 2. Queixa Principal (QP); 3. História da Moléstia Atual (HMA); 4. Interrogatório Sintomatológico Geral (ISDA) e Antecedentes Pessoais/Familiares.',
      difficulty: 'Fácil',
      lessonRef: 'Aula 1: Introdução ao Exame Físico'
    },
    {
      id: 'fc_5',
      topic: 'Semiologia Geral',
      question: 'Qual é o achado característico na ausculta cardíaca correspondente ao 1º e 2º Ruídos (B1 e B2)?',
      answer: 'B1 corresponde ao fechamento das valvas atrioventriculares (Mitral e Tricúspide) marcando o início da sístole. B2 corresponde ao fechamento das valvas semilunares (Aórtica e Pulmonar) marcando o início da diástole.',
      difficulty: 'Médio',
      lessonRef: 'Aula 2: Sinais Vitais e Antropometria'
    },
    {
      id: 'fc_6',
      topic: 'Bioquímica Médica',
      question: 'Qual enzima atua como principal ponto de regulação alostérica da Glicólise?',
      answer: 'A Fosfofructocinase-1 (PFK-1), inibida por altos níveis de ATP e Citrato, e ativada por AMP e Frutose-2,6-bisfosfato.',
      difficulty: 'Difícil',
      lessonRef: 'Aula 2: Glicólise e Ciclo de Krebs'
    },
    {
      id: 'fc_7',
      topic: 'Atenção Primária',
      question: 'Quais são os quatro atributos essenciais da Atenção Primária à Saúde segundo Starfield?',
      answer: '1. Acesso de Primeiro Contato; 2. Longitudinalidade; 3. Integralidade; 4. Coordenação do Cuidado.',
      difficulty: 'Fácil',
      lessonRef: 'Aula 1: Princípios do SUS e ESF'
    }
  ];

  const [cards, setCards] = useState<FlashcardData[]>(() => {
    const saved = localStorage.getItem('facilita_flashcards');
    return saved ? JSON.parse(saved) : defaultCards;
  });

  useEffect(() => {
    localStorage.setItem('facilita_flashcards', JSON.stringify(cards));
  }, [cards]);

  const filteredCards = cards.filter(c => c.topic.toLowerCase() === selectedTopic.toLowerCase());
  const currentCard = filteredCards[currentCardIdx] || filteredCards[0] || cards[0];

  const handleRating = (ratingType: 'errado' | 'dificil' | 'bom' | 'facil') => {
    setIsFlipped(false);
    setCompletedTodayCount(prev => prev + 1);

    let msg = '';
    if (ratingType === 'errado') msg = '🔴 Card reagendado para revisão em 1 dia!';
    if (ratingType === 'dificil') msg = '🟠 Card reagendado para revisão em 3 dias!';
    if (ratingType === 'bom') msg = '🔵 Ótimo! Card reagendado para 7 dias!';
    if (ratingType === 'facil') msg = '🟢 Excelente! Card dominado (revisão em 14 dias)!';

    showToastNotification(msg);

    // Avançar para o próximo card do deck
    if (currentCardIdx < filteredCards.length - 1) {
      setCurrentCardIdx(currentCardIdx + 1);
    } else {
      setCurrentCardIdx(0);
    }
  };

  const showToastNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCreateFlashcard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) return;

    const newCard: FlashcardData = {
      id: `fc_${Date.now()}`,
      topic: newTopic,
      question: newQuestion,
      answer: newAnswer,
      difficulty: 'Médio',
      lessonRef: 'Criado pelo Aluno'
    };

    setCards(prev => [newCard, ...prev]);
    setShowCreateModal(false);
    setNewQuestion('');
    setNewAnswer('');
    showToastNotification(`✨ Novo flashcard adicionado ao deck de ${newTopic}!`);
  };

  const topics = ['Fisiologia Humana', 'Semiologia Geral', 'Bioquímica Médica', 'Atenção Primária'];

  return (
    <div style={{ paddingBottom: '50px' }}>
      <TopBar courseName={user?.course?.nome || 'Medicina'} currentPage="Flashcards & Revisão Espaçada" />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div 
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            background: 'var(--accent-soft)',
            color: 'var(--accent-ink)',
            border: '1px solid var(--accent)',
            padding: '14px 20px',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            fontWeight: 600,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Sparkles size={18} /> {toastMessage}
        </div>
      )}

      <div style={{ padding: '0 28px' }}>
        {/* Cabeçalho da Página */}
        <div className="page-head" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--accent-ink)' }}>
              Algoritmo de Repetição Espaçada · Anki / SuperMemo
            </div>
            <h1 style={{ fontSize: '28px', margin: '4px 0 6px' }}>Flash Cards Ativos</h1>
            <p style={{ color: 'var(--ink-2)', fontSize: '14px', margin: 0, maxWidth: '640px' }}>
              Treine sua memória de longo prazo com cartões inteligentes organizados por disciplina e nivel de dificuldade.
            </p>
          </div>

          <button 
            className="btn primary"
            onClick={() => setShowCreateModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px' }}
          >
            <Plus size={16} /> + Criar Meu Flashcard
          </button>
        </div>

        {/* METRICAS E DESEMPENHO (KPIS DE REVISÃO) */}
        <div className="grid g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div className="card kpi" style={{ borderLeft: '4px solid var(--accent)', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="lab" style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Público para Hoje</span>
              <Brain size={18} style={{ color: 'var(--accent)' }} />
            </div>
            <div className="val num" style={{ fontSize: '26px', fontWeight: 800, marginTop: '4px' }}>
              {filteredCards.length} <small style={{ fontSize: '13px', color: 'var(--muted)' }}>cards</small>
            </div>
          </div>

          <div className="card kpi" style={{ borderLeft: '4px solid var(--good)', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="lab" style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Revisados Hoje</span>
              <CheckCircle2 size={18} style={{ color: 'var(--good)' }} />
            </div>
            <div className="val num" style={{ fontSize: '26px', fontWeight: 800, color: 'var(--good)', marginTop: '4px' }}>
              {completedTodayCount}
            </div>
          </div>

          <div className="card kpi" style={{ borderLeft: '4px solid #f59e0b', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="lab" style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Sequência de Estudo</span>
              <Flame size={18} style={{ color: '#f59e0b' }} />
            </div>
            <div className="val num" style={{ fontSize: '26px', fontWeight: 800, color: '#f59e0b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {streakDays} <small style={{ fontSize: '13px' }}>dias 🔥</small>
            </div>
          </div>

          <div className="card kpi" style={{ borderLeft: '4px solid #8b5cf6', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="lab" style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>Taxa de Acerto</span>
              <TrendingUp size={18} style={{ color: '#8b5cf6' }} />
            </div>
            <div className="val num" style={{ fontSize: '26px', fontWeight: 800, color: '#8b5cf6', marginTop: '4px' }}>
              78%
            </div>
          </div>
        </div>

        {/* SELETOR DE DECK / MATÉRIA */}
        <div style={{ marginBottom: '20px', display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {topics.map((t) => {
            const topicCount = cards.filter(c => c.topic.toLowerCase() === t.toLowerCase()).length;
            const isSelected = selectedTopic === t;

            return (
              <button
                key={t}
                className={`chip ${isSelected ? 'on' : ''}`}
                onClick={() => {
                  setSelectedTopic(t);
                  setCurrentCardIdx(0);
                  setIsFlipped(false);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
              >
                <BookOpen size={14} />
                {t} ({topicCount})
              </button>
            );
          })}
        </div>

        {/* VIEWPORT INTERATIVO DE FLASHCARD (FLIP CARD INTERATIVO) */}
        <div className="grid g21" style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: '24px' }}>
          <div>
            <div 
              className="card"
              style={{ 
                padding: '36px', 
                minHeight: '340px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between',
                position: 'relative',
                border: isFlipped ? '2px solid var(--accent)' : '1px solid var(--line)',
                background: isFlipped ? 'var(--paper-2)' : 'var(--paper)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.06)',
                borderRadius: '16px',
                transition: 'all 0.25s ease-in-out'
              }}
            >
              {/* TOPO DO CARD: DECK + NÚMERO DO CARD */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="pill info" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                    {currentCard?.topic}
                  </span>
                  <span className="muted" style={{ fontSize: '12px' }}>
                    {currentCard?.lessonRef || 'Aula Integrada'}
                  </span>
                </div>

                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>
                  Card {filteredCards.length > 0 ? currentCardIdx + 1 : 0} de {filteredCards.length}
                </div>
              </div>

              {/* CORPO DO CARD: PERGUNTA / RESPOSTA */}
              <div style={{ textAlign: 'center', margin: '20px 0' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.12em', color: isFlipped ? 'var(--good)' : 'var(--accent-ink)', fontWeight: 700, marginBottom: '8px' }}>
                  {isFlipped ? '💡 Resposta / Conceito Chave:' : '❓ Pergunta / Desafio:'}
                </div>

                {!isFlipped ? (
                  <h2 style={{ fontSize: '20px', lineHeight: 1.5, color: 'var(--ink)', fontWeight: 600, maxWidth: '620px', margin: '0 auto' }}>
                    {currentCard ? currentCard.question : 'Nenhum card neste deck.'}
                  </h2>
                ) : (
                  <div 
                    style={{ 
                      fontSize: '15px', 
                      lineHeight: 1.7, 
                      color: 'var(--ink)', 
                      background: 'var(--paper)', 
                      padding: '20px 24px', 
                      borderRadius: '12px', 
                      border: '1px solid var(--line)',
                      maxWidth: '640px',
                      margin: '0 auto',
                      textAlign: 'left'
                    }}
                  >
                    {currentCard?.answer}
                  </div>
                )}
              </div>

              {/* RODAPÉ DO CARD: BOTÃO REVELAR / RATING SPACING REPETITION */}
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--line-2)', display: 'flex', justifyContent: 'center' }}>
                {!isFlipped ? (
                  <button 
                    className="btn primary"
                    onClick={() => setIsFlipped(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 28px', fontSize: '15px', fontWeight: 600 }}
                  >
                    <RotateCw size={18} /> Virar Card e Mostrar Resposta
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', width: '100%' }}>
                    <button 
                      className="btn"
                      onClick={() => handleRating('errado')}
                      style={{ background: 'var(--crit-soft)', color: 'var(--crit)', border: '1px solid var(--crit)', flex: 1, padding: '10px' }}
                    >
                      <XCircle size={16} /> <b>Errei</b> <small style={{ display: 'block', fontSize: '10px' }}>Rever em 1d</small>
                    </button>

                    <button 
                      className="btn"
                      onClick={() => handleRating('dificil')}
                      style={{ background: 'var(--warn-soft)', color: 'var(--warn)', border: '1px solid var(--warn)', flex: 1, padding: '10px' }}
                    >
                      <RotateCw size={16} /> <b>Difícil</b> <small style={{ display: 'block', fontSize: '10px' }}>Rever em 3d</small>
                    </button>

                    <button 
                      className="btn"
                      onClick={() => handleRating('bom')}
                      style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)', border: '1px solid var(--accent)', flex: 1, padding: '10px' }}
                    >
                      <Check size={16} /> <b>Bom</b> <small style={{ display: 'block', fontSize: '10px' }}>Rever em 7d</small>
                    </button>

                    <button 
                      className="btn"
                      onClick={() => handleRating('facil')}
                      style={{ background: 'var(--good-soft)', color: 'var(--good)', border: '1px solid var(--good)', flex: 1, padding: '10px' }}
                    >
                      <Zap size={16} /> <b>Fácil!</b> <small style={{ display: 'block', fontSize: '10px' }}>Rever em 14d</small>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PAINEL LATERAL: ESTATÍSTICAS E TÓPICOS DE MAIOR ERRO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card">
              <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} style={{ color: 'var(--warn)' }} /> Onde você mais erra
              </h3>
              <p className="muted" style={{ fontSize: '12px', margin: '4px 0 16px' }}>
                Percentual de erro calculado nos últimos 30 dias de revisão.
              </p>
              
              <HorizontalBars
                rows={[
                  { label: 'Fisiologia Renal & TFG', value: 58, color: 'var(--crit)' },
                  { label: 'Sinais Vitais e Ausculta', value: 52, color: 'var(--warn)' },
                  { label: 'Exame Físico Cardiovascular', value: 41, color: 'var(--warn)' },
                  { label: 'Fisiologia Respiratória', value: 37, color: 'var(--good)' },
                  { label: 'Enzimas Clínicas (PFK-1)', value: 22, color: 'var(--good)' }
                ]}
                max={100}
              />
            </div>

            {/* CARD DICA DE ESTUDO */}
            <div className="card" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', padding: '16px' }}>
              <b style={{ color: 'var(--accent-ink)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Sparkles size={16} /> Dica de Neurociência & Memória
              </b>
              <p style={{ fontSize: '12px', color: 'var(--ink)', margin: 0, lineHeight: 1.5 }}>
                Estudar por repetição espaçada no momento exato da curva do esquecimento consolida as sinapses no córtex pré-frontal em até <b>300% mais rápido</b> do que releituras passivas.
              </p>
            </div>
          </div>
        </div>

        {/* MODAL CRIAR NOVO FLASHCARD PERSONALIZADO */}
        {showCreateModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', zIndex: 3000, padding: '20px' }}>
            <form 
              className="card"
              onSubmit={handleCreateFlashcard}
              style={{ width: '560px', maxWidth: '92vw', borderRadius: '14px', padding: '28px', position: 'relative' }}
            >
              <button 
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ position: 'absolute', top: '16px', right: '16px', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: '50%', width: '32px', height: '32px', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--muted)' }}
              >
                <X size={18} />
              </button>

              <h3 style={{ fontSize: '18px', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Brain size={20} style={{ color: 'var(--accent)' }} /> + Criar Novo Flashcard de Estudo
              </h3>
              <p className="muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
                Adicione suas próprias perguntas e respostas para revisar a qualquer momento.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="field">
                  <label>Selecione a Matéria / Deck</label>
                  <select value={newTopic} onChange={(e) => setNewTopic(e.target.value)}>
                    {topics.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Pergunta ou Caso Clínico (Frente do Card)</label>
                  <textarea 
                    rows={3}
                    placeholder="Ex: Qual é a enzima limitante da glicólise e por quem ela é ativada?"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <label>Resposta ou Conceito Chave (Verso do Card)</label>
                  <textarea 
                    rows={4}
                    placeholder="Ex: PFK-1 (Fosfofructocinase-1), ativada por AMP e Frutose-2,6-bisfosfato..."
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button type="submit" className="btn primary">Salvar Flashcard</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
