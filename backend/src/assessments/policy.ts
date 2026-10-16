import { PlanError } from '../controllers/plan-policy';

export function examSettings(body: Record<string, unknown>) {
  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  if (!nome || nome.length > 160 || !Number.isInteger(body.maxAttempts) || Number(body.maxAttempts) < 1 || Number(body.maxAttempts) > 20 ||
    typeof body.passingScore !== 'number' || !Number.isFinite(body.passingScore) || body.passingScore < 0 || body.passingScore > 10) {
    throw new PlanError(400, 'Informe nome, limite de 1 a 20 tentativas e nota mínima entre 0 e 10.');
  }
  return { nome, maxAttempts: Number(body.maxAttempts), passingScore: body.passingScore };
}
export function questionSettings(body: Record<string, unknown>) {
  const enunciado = typeof body.enunciado === 'string' ? body.enunciado.trim() : '';
  const alternatives = Array.isArray(body.alternatives) ? body.alternatives : [];
  const explanation = typeof body.explanation === 'string' ? body.explanation.trim() : '';
  if (!enunciado || enunciado.length > 10000 || alternatives.length < 2 || alternatives.length > 6 ||
    !alternatives.every(a => typeof a === 'string' && a.trim().length > 0 && a.trim().length <= 2000) ||
    !Number.isInteger(body.correctIndex) || Number(body.correctIndex) < 0 || Number(body.correctIndex) >= alternatives.length || explanation.length > 10000) {
    throw new PlanError(400, 'Preencha o enunciado, de 2 a 6 alternativas e a resposta correta.');
  }
  return { enunciado, alts: JSON.stringify(alternatives.map(a => a.trim())), correta: Number(body.correctIndex), comentario: explanation, topic: '' };
}
export type StoredQuestion = { id: number; enunciado: string; alts: string; correta: number; comentario: string };
export function serializeQuestion(question: StoredQuestion, editor: boolean) {
  let alternatives: unknown = [];
  try { alternatives = JSON.parse(question.alts); } catch { /* malformed legacy content is never published */ }
  return { id: question.id, enunciado: question.enunciado, alternatives: Array.isArray(alternatives) ? alternatives : [],
    ...(editor ? { correctIndex: question.correta, explanation: question.comentario } : {}) };
}
export function gradeAnswers(questions: StoredQuestion[], answers: unknown) {
  if (!questions.length || !Array.isArray(answers) || answers.length !== questions.length) throw new PlanError(400, 'Responda todas as questões antes de enviar.');
  const selected = new Map<number, number>();
  for (const answer of answers) {
    if (!answer || typeof answer !== 'object' || Object.keys(answer).some(k => !['questionId', 'alternativeIndex'].includes(k)) ||
      !Number.isInteger(answer.questionId) || !Number.isInteger(answer.alternativeIndex) || selected.has(answer.questionId)) {
      throw new PlanError(400, 'As respostas enviadas são inválidas.');
    }
    selected.set(answer.questionId, answer.alternativeIndex);
  }
  const feedback = questions.map(question => {
    const safe = serializeQuestion(question, true);
    const selectedIndex = selected.get(question.id);
    if (selectedIndex === undefined || selectedIndex < 0 || selectedIndex >= safe.alternatives.length) throw new PlanError(400, 'Selecione uma alternativa válida para cada questão.');
    return { questionId: question.id, enunciado: safe.enunciado, alternatives: safe.alternatives as string[], selectedIndex,
      correctIndex: question.correta, explanation: question.comentario };
  });
  const correct = feedback.filter(q => q.selectedIndex === q.correctIndex).length;
  return { feedback, correct, total: questions.length, score: Math.round(correct / questions.length * 1000) / 100 };
}
