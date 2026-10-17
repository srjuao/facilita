/** Only the first unfinished lesson is available to a learner. */
export function isLessonLocked(index: number, orderedIds: string[], completed: ReadonlySet<string>, role: string) {
  return role === 'aluno' && index > 0 && !completed.has(orderedIds[index - 1]);
}

export function isFinalExamLocked(orderedIds: string[], completed: ReadonlySet<string>, role: string) {
  return role === 'aluno' && orderedIds.some(id => !completed.has(id));
}
