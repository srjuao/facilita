import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import { ChatMessage } from '../../types';

export const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadHistory = async () => {
    try {
      const res = await api.get('/chat/history');
      setMessages(res.data);
    } catch (err) {
      setError('Não foi possível carregar o histórico do chat.');
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    setInput(''); setError('');
    setLoading(true);

    // Adiciona otimista
    const tempMsg: ChatMessage = { id: Date.now().toString(), role: 'me', content: text };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await api.post('/chat/send', { content: text });
      setMessages(prev => [...prev.filter(m => m.id !== tempMsg.id), res.data.userMessage, res.data.aiMessage]);
    } catch (err: any) {
      setMessages(prev => prev.filter(message => message.id !== tempMsg.id)); setInput(text);
      setError(err.response?.data?.error || 'Não foi possível enviar a mensagem. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <h1>IA Tira-Dúvidas</h1>
          <p>O acesso depende do plano contratado. Respostas reais exigem a integração de um provedor de IA.</p>
        </div>
      </div>

      {error && <p role="alert" className="inline-form-error">{error}</p>}
      <div className="card" style={{ marginTop: '20px', minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
        <div className="chat" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`msg ${msg.role === 'ai' ? 'ai' : 'me'}`}
              style={{ whiteSpace: 'pre-wrap' }}
            >{msg.content}</div>
          ))}
          {loading && (
            <div className="msg ai">
              <i>Digitando resposta...</i>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: '16px', borderTop: '1px solid var(--line)', background: 'var(--paper)' }}>
          <div className="ask" style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              placeholder="Digite sua pergunta aqui…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button className="btn primary" onClick={() => handleSend()}>
              Enviar
            </button>
          </div>

          <div className="sug" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button className="chip" onClick={() => handleSend('Resumo deste tema')}>
              Resumo deste tema
            </button>
            <button className="chip" onClick={() => handleSend('Explique de forma simples')}>
              Explique de forma simples
            </button>
            <button className="chip" onClick={() => handleSend('Dê um exemplo prático')}>
              Dê um exemplo prático
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
